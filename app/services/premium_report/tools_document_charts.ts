import { PREMIUM_BLOCK_TYPE, PREMIUM_CHART_PRESET, PREMIUM_LINE_MAX_ATHLETES, PREMIUM_RADAR_MAX_SERIES, PREMIUM_REPORT_MAX_HEADING_LENGTH, isPremiumChartPreset, type PremiumChartPreset } from '#constants/premium_report.constants'
import { chartHintAsPreset } from '#constants/premium_report_intent'
import { chartDisplayRowCap, runVizGate } from '#services/premium_report/premium_report_viz_validator'
import type { PremiumReportBlock } from '#contracts/premium_report'
import { bindChartDataset, hasChartEmbeddedSource, implausibleMetricWarning, newBlockId, sanitizePlainObject } from '#services/premium_report/premium_report_document'
import { buildPresetFromDataset, chunkAthletes, filterDatasetByAthletes, feasibleChartTypes, inferChartType, listDatasetAthletes, pickCategoryColumn, planRadarAthleteRows, scoreChartJobs, uniqueColumnCount, type ChartRefLines } from '#services/premium_report/chart_presets'
import { relabelDatasetColumns } from '#services/premium_report/column_labels'
import { pickDateColumn, readString, readStringList, sortDatasetByDate, trimDatasetRows } from '#services/premium_report/dataset_ops'
import { resolveChartRules, stampMaunaChartLayout } from '#services/premium_report/charts/chart_rules'
import type { PremiumReportState, PremiumTool } from '#services/premium_report/premium_report_tools'

import {
  coachAskedEveryPlayerLines,
  coachAskedTeamMeanEnvelope,
  staffSplitGroupTitle,
  acwrSeriesTooSparse,
  chartColumnFailFast,
  resolveToolDataset,
  commitInsert,
} from '#services/premium_report/tools_document_shared'

export const createChartDocumentTools = (state: PremiumReportState): PremiumTool[] => [
  {
    schema: {
      name: 'add_chart',
      description: `Add chart from datasetId. ALWAYS pass chartType (line|bar|radar|scatter|heatmap|donut|bar-line). Never mix performance_score and injury_risk_score on one chart. Radar = single athlete multi-axis profile only — multi-athlete wellness/GPS profiles auto-coerce to grouped bar. Single athlete + same-scale subjective ratings (mood/stress/energy/soreness/sleep quality on the club Likert band) → ONE line chart with values=[...] for all compatible ratings. Multi-athlete lines stay ONE metric (use athletes:[] or splitAthletes). Title = metric or "Wellness" for multi-rating; no athlete name ranges (legend carries names; split parts use i/n). Staff overview: athletes:[...] (≤${PREMIUM_LINE_MAX_ATHLETES}) or charts_to_team mode=overlay — do NOT splitAthletes the whole roster. splitAthletes:true when coach asked every player / individual lines (chunks ≤${PREMIUM_LINE_MAX_ATHLETES}). Individuals + team mean/minmax → split chunks PLUS separate aggregate mean±minmax charts.`,
      input_schema: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          datasetId: { type: 'string' },
          datasetIds: { type: 'array', items: { type: 'string' } },
          chartType: {
            type: 'string',
            enum: ['donut', 'bar', 'line', 'bar-line', 'heatmap', 'radar', 'scatter'],
          },
          category: { type: 'string' },
          values: { type: 'array', items: { type: 'string' } },
          athletes: {
            type: 'array',
            items: { type: 'string' },
            description: 'Limit line series to these athlete names (exact match on joueur).',
          },
          splitAthletes: {
            type: 'boolean',
            description: `Opt-in when coach asked every player / individually / individual evolutions. Chunks into ≤${PREMIUM_LINE_MAX_ATHLETES} series; titles stay metric (+ i/n), never athlete ranges. Default false — prefer athletes:[...] Top-N or charts_to_team.`,
          },
          refLines: {
            type: 'string',
            enum: ['none', 'mean', 'mean_median', 'full'],
            description:
              'Default none. Use mean/mean_median only when a squad baseline is useful (ranking vs average) — not on multi-player evolutions.',
          },
          option: { type: 'object' },
          after: { type: 'string' },
        },
        required: ['title', 'chartType'],
      },
    },
    execute: async (input) => {
      const title = readString(input.title)?.trim() || 'Chart'
      const resolved = resolveToolDataset(state, input)
      if (typeof resolved === 'string') return resolved
      if (state.limits?.requireLiveDatasetId && !resolved) {
        return JSON.stringify({
          error: 'report_v4 requires live datasetId for add_chart',
          hint: 'Pass datasetId from linker/macros — do not invent option-only charts.',
        })
      }
      const chartTypeRaw = readString(input.chartType)

      let chartType: PremiumChartPreset | undefined
      if (chartTypeRaw && isPremiumChartPreset(chartTypeRaw)) {
        chartType = chartTypeRaw
      } else if (resolved) {
        const hinted = chartHintAsPreset(state.intent.chartHint)
        const feasible = feasibleChartTypes(resolved)
        if (hinted && feasible.includes(hinted)) {
          chartType = hinted
        } else {
          chartType = inferChartType(resolved)
        }
      } else {
        chartType = undefined
      }

      let dataset = resolved
      const athleteFilter = readStringList(input.athletes)
      if (dataset && athleteFilter.length) {
        dataset = filterDatasetByAthletes(dataset, athleteFilter)
        if (dataset.rows.length === 0) {
          return JSON.stringify({
            error: 'No rows for athletes filter',
            athletes: athleteFilter,
          })
        }
      }

      if (
        dataset &&
        chartType === PREMIUM_CHART_PRESET.SCATTER &&
        pickDateColumn(dataset.columns) &&
        /évol|evol|quotidien|daily|trend|time.?series|temporel/i.test(title)
      ) {
        chartType = PREMIUM_CHART_PRESET.LINE
      }

      if (dataset) {
        const colError = chartColumnFailFast(dataset, input)
        if (colError) return colError
        const categoryCol = pickCategoryColumn(dataset, readString(input.category) ?? undefined)
        const uniqueCategories = uniqueColumnCount(dataset, categoryCol)
        const jevError = runVizGate(state, {
          toolName: 'add_chart',
          title,
          datasetColumns: dataset.columns,
          datasetRowCount: dataset.rows.length,
          chartType: chartType ?? (chartTypeRaw || 'auto'),
          uniqueCategories,
        })
        if (jevError) return jevError
      }

      const incoming = sanitizePlainObject(input.option)
      const refRaw = readString(input.refLines)
      const rowCap = chartDisplayRowCap(chartTypeRaw || chartType || 'auto', dataset?.columns ?? [])
      const rules = resolveChartRules({
        request: state.requestPrompt,
        title,
        language: state.language,
        chartType: chartTypeRaw || chartType,
        rowCount: dataset?.rows.length ?? 0,
        hasDate: Boolean(dataset && pickDateColumn(dataset.columns)),
        columns: dataset?.columns,
      })
      const refLines: ChartRefLines =
        refRaw === 'none' || refRaw === 'mean' || refRaw === 'full' || refRaw === 'mean_median'
          ? refRaw
          : rules.refLines

      const isLine = chartType === PREMIUM_CHART_PRESET.LINE
      const allAthletes = dataset && isLine ? listDatasetAthletes(dataset) : []
      const scoreJobs =
        dataset && chartType
          ? scoreChartJobs({
              columns: dataset.columns,
              requestedValues: readStringList(input.values),
              title,
              chartType,
              language: state.language,
              intentOverride: rules.scoreIntent,
            })
          : null
      let chartValues = scoreJobs?.[0]?.values ?? readStringList(input.values)
      const chartTitle = (scoreJobs?.[0]?.title ?? title).slice(
        0,
        PREMIUM_REPORT_MAX_HEADING_LENGTH
      )
      const everyPlayerLines = coachAskedEveryPlayerLines(state)
      const wantsTeamEnvelope = coachAskedTeamMeanEnvelope(state.requestPrompt)
      if (input.splitAthletes === true && athleteFilter.length === 0) {
        if (!everyPlayerLines) {
          return JSON.stringify({
            error:
              'splitAthletes rejected for staff overview — would chunk the whole roster. Pass athletes:[Top-N / named / watch] (≤6) or charts_to_team mode=overlay for squad mean. Use splitAthletes only when the coach asked every player / individually / individual lines.',
            athletesTotal: allAthletes.length,
            athletesPerChart: PREMIUM_LINE_MAX_ATHLETES,
            hint: 'Top-N + mean: filter_dataset top=N then athletes=[...] + charts_to_team overlay.',
          })
        }
      }
      const shouldSplit =
        Boolean(dataset) &&
        Boolean(chartType) &&
        isLine &&
        allAthletes.length > PREMIUM_LINE_MAX_ATHLETES &&
        input.splitAthletes === true &&
        everyPlayerLines &&
        athleteFilter.length === 0

      if (
        dataset &&
        chartType &&
        isLine &&
        allAthletes.length > PREMIUM_LINE_MAX_ATHLETES &&
        !shouldSplit &&
        athleteFilter.length === 0
      ) {
        return JSON.stringify({
          error: `Roster has ${allAthletes.length} athletes (>${PREMIUM_LINE_MAX_ATHLETES} line series). Pass athletes:[...] for Top-N/outliers/watch, or charts_to_team mode=overlay for squad mean. Do not splitAthletes unless the coach asked every player / individually.`,
          athletesTotal: allAthletes.length,
          athletesPerChart: PREMIUM_LINE_MAX_ATHLETES,
          hint: everyPlayerLines
            ? `Coach asked individual lines — retry with splitAthletes:true (chunks ≤${PREMIUM_LINE_MAX_ATHLETES}; metric titles + i/n).`
            : undefined,
        })
      }

      if (dataset && isLine) {
        const sparse = acwrSeriesTooSparse(dataset, chartValues)
        if (sparse) return sparse
      }

      const emitLineGroups = (
        metricTitle: string,
        values: string[],
        afterCursor?: string
      ): string | { charts: Array<{ id: string; title: string; athletes: string[] }> } => {
        if (!dataset || !chartType) return { charts: [] }
        const groups = chunkAthletes(allAthletes, PREMIUM_LINE_MAX_ATHLETES)
        const charts: Array<{ id: string; title: string; athletes: string[] }> = []
        let cursor = afterCursor
        for (let i = 0; i < groups.length; i++) {
          const group = groups[i]!
          const sliced = filterDatasetByAthletes(dataset, group)
          const capped = trimDatasetRows(sliced, rowCap)
          const built = buildPresetFromDataset(
            chartType,
            capped.dataset,
            readString(input.category),
            values,
            refLines,
            state.language,
            metricTitle
          )
          if (typeof built === 'string') return built
          const groupTitle =
            groups.length > 1
              ? staffSplitGroupTitle(metricTitle, group, i, groups.length)
              : metricTitle
          const block: PremiumReportBlock = {
            id: newBlockId(),
            type: PREMIUM_BLOCK_TYPE.CHART,
            title: groupTitle,
            option: stampMaunaChartLayout(
              bindChartDataset(built, capped.dataset, state.language),
              'individual'
            ),
          }
          const inserted = commitInsert(state, block, cursor)
          try {
            const parsed = JSON.parse(inserted) as { id?: string }
            if (parsed.id) cursor = parsed.id
            charts.push({ id: parsed.id ?? block.id, title: groupTitle, athletes: group })
          } catch {
            charts.push({ id: block.id, title: groupTitle, athletes: group })
          }
        }
        return { charts }
      }

      if (dataset && chartType && scoreJobs && scoreJobs.length > 1) {
        const created: Array<{ id: string; title: string; values: string[] }> = []
        let cursor = readString(input.after)
        for (const job of scoreJobs) {
          if (shouldSplit) {
            const grouped = emitLineGroups(job.title, job.values, cursor)
            if (typeof grouped === 'string') return grouped
            for (const chart of grouped.charts) {
              cursor = chart.id
              created.push({ id: chart.id, title: chart.title, values: job.values })
            }
            continue
          }
          const capped = trimDatasetRows(dataset, rowCap)
          const built = buildPresetFromDataset(
            chartType,
            capped.dataset,
            readString(input.category),
            job.values,
            refLines,
            state.language,
            job.title
          )
          if (typeof built === 'string') return built
          const stamped = stampMaunaChartLayout(
            bindChartDataset(built, capped.dataset, state.language),
            rules.layout
          )
          const block: PremiumReportBlock = {
            id: newBlockId(),
            type: PREMIUM_BLOCK_TYPE.CHART,
            title: job.title.slice(0, PREMIUM_REPORT_MAX_HEADING_LENGTH),
            option: stamped,
          }
          const inserted = commitInsert(state, block, cursor)
          try {
            const parsed = JSON.parse(inserted) as { id?: string }
            if (parsed.id) cursor = parsed.id
            created.push({ id: parsed.id ?? block.id, title: job.title, values: job.values })
          } catch {
            created.push({ id: block.id, title: job.title, values: job.values })
          }
        }
        return JSON.stringify({
          ok: true,
          splitScores: true,
          ...(shouldSplit ? { splitAthletes: true } : {}),
          charts: created,
          hint: shouldSplit
            ? wantsTeamEnvelope
              ? 'Separate perf/injury chunked lines done. Also add team mean±minmax via aggregate_dataset ops=[mean,min,max] on the same score column (dedicated envelope charts) — do not rely on overlay alone for full-squad band.'
              : 'Separate perf/injury chunked individual lines. Titles = metric (+ i/n), never athlete ranges.'
            : 'performance_score and injury_risk_score cannot share a line/bar. Prefer athletes:[watch] or one team-mean line — not full-roster splits unless the coach asked individuals.',
        })
      }

      if (dataset && chartType && isLine && shouldSplit) {
        const grouped = emitLineGroups(chartTitle, chartValues, readString(input.after))
        if (typeof grouped === 'string') return grouped
        return JSON.stringify({
          ok: true,
          splitAthletes: true,
          charts: grouped.charts,
          athletesTotal: allAthletes.length,
          athletesPerChart: PREMIUM_LINE_MAX_ATHLETES,
          note: `Split into ${grouped.charts.length} line charts (≤${PREMIUM_LINE_MAX_ATHLETES} each). Titles = metric (+ i/n), never athlete ranges or Group N.`,
          hint: wantsTeamEnvelope
            ? 'Individuals done. Add separate team mean±minmax: aggregate_dataset groupBy=date_of_day ops=[mean,min,max] then add_chart with envelope title — keep chunks as individual lines.'
            : undefined,
        })
      }

      let radarCategoryOverride: string | undefined
      if (dataset && chartType === PREMIUM_CHART_PRESET.RADAR) {
        const labeled = sortDatasetByDate(relabelDatasetColumns(dataset, state.language))
        const dateColumn = pickDateColumn(labeled.columns)
        const categoryCol = pickCategoryColumn(labeled, readString(input.category) ?? undefined)
        const planned = planRadarAthleteRows(labeled, categoryCol, chartValues, dateColumn)
        if (typeof planned === 'string') return planned
        if (planned.rows.length > PREMIUM_RADAR_MAX_SERIES) {
          chartType = PREMIUM_CHART_PRESET.BAR
          dataset = { ...labeled, rows: planned.rows }
          chartValues = planned.values
          radarCategoryOverride = planned.category
        }
      }

      let trimmedFrom: number | undefined
      if (dataset) {
        const capped = trimDatasetRows(dataset, rowCap)
        dataset = capped.dataset
        trimmedFrom = capped.trimmedFrom
      }

      const built =
        dataset && chartType
          ? buildPresetFromDataset(
              chartType,
              dataset,
              radarCategoryOverride ?? readString(input.category),
              chartValues,
              refLines,
              state.language,
              chartTitle
            )
          : undefined
      if (typeof built === 'string') return built
      const option = built ?? incoming
      if (!option) {
        return JSON.stringify({
          error: 'Pass datasetId (chartType optional — auto-inferred) or option.',
        })
      }
      if (!dataset && !hasChartEmbeddedSource(option)) {
        return JSON.stringify({
          error:
            'Pass datasetId from query_database, or put dataset.source / series.data in option.',
        })
      }
      if (dataset) {
        const metricWarning = implausibleMetricWarning(dataset, state.dateRange)
        if (metricWarning) return JSON.stringify({ error: metricWarning })
      }
      const block: PremiumReportBlock = {
        id: newBlockId(),
        type: PREMIUM_BLOCK_TYPE.CHART,
        title: chartTitle,
        option: stampMaunaChartLayout(
          dataset ? bindChartDataset(option, dataset, state.language) : option,
          rules.layout
        ),
      }
      const inserted = commitInsert(state, block, readString(input.after))
      const extras: Record<string, unknown> = {}
      if (trimmedFrom) {
        extras.trimmedRows = trimmedFrom
        extras.note = `Kept last ${dataset?.rows.length ?? 0} rows for chart readability.`
      }
      if (radarCategoryOverride) {
        extras.radarCoercedToBar = true
        extras.hint = 'Radar is single-athlete only; multi-athlete profile rendered as grouped bar.'
      }
      if (!Object.keys(extras).length) return inserted
      try {
        return JSON.stringify({
          ...(JSON.parse(inserted) as Record<string, unknown>),
          ...extras,
        })
      } catch {
        return inserted
      }
    },
  }
]
