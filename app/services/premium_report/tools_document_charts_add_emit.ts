import {
  PREMIUM_BLOCK_TYPE,
  PREMIUM_CHART_PRESET,
  PREMIUM_LINE_MAX_ATHLETES,
  PREMIUM_RADAR_MAX_SERIES,
  PREMIUM_REPORT_MAX_HEADING_LENGTH,
  type PremiumChartPreset,
} from '#constants/premium_report.constants'
import type { PremiumReportBlock } from '#contracts/premium_report'
import {
  bindChartDataset,
  hasChartEmbeddedSource,
  implausibleMetricWarning,
  newBlockId,
} from '#services/premium_report/premium_report_document'
import {
  buildPresetFromDataset,
  chunkAthletes,
  filterDatasetByAthletes,
  pickCategoryColumn,
  planRadarAthleteRows,
  type ChartRefLines,
  type ScoreChartJob,
} from '#services/premium_report/chart_presets'
import { relabelDatasetColumns } from '#services/premium_report/column_labels'
import { pickDateColumn, readString, sortDatasetByDate, trimDatasetRows } from '#services/premium_report/dataset_ops'
import { stampMaunaChartLayout } from '#services/premium_report/charts/chart_rules'
import type { PremiumReportState } from '#services/premium_report/premium_report_tools'
import type { PremiumDataset } from '#contracts/premium_report'
import {
  staffSplitGroupTitle,
  commitInsert,
} from '#services/premium_report/tools_document_shared'
import type { AddChartPrepared } from '#services/premium_report/tools_document_charts_add_prepare'

export const emitAddChartLineGroups = (args: {
  state: PremiumReportState
  input: Record<string, unknown>
  dataset: PremiumDataset
  chartType: PremiumChartPreset
  allAthletes: string[]
  rowCap: number
  refLines: ChartRefLines
  metricTitle: string
  values: string[]
  afterCursor?: string
}): string | { charts: Array<{ id: string; title: string; athletes: string[] }> } => {
  const { state, input, dataset, chartType, allAthletes, rowCap, refLines, metricTitle, values } =
    args
  const groups = chunkAthletes(allAthletes, PREMIUM_LINE_MAX_ATHLETES)
  const charts: Array<{ id: string; title: string; athletes: string[] }> = []
  let cursor = args.afterCursor
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

export const emitMultiScoreAddCharts = (args: {
  state: PremiumReportState
  input: Record<string, unknown>
  prepared: AddChartPrepared
  scoreJobs: ScoreChartJob[]
}): string => {
  const { state, input, prepared, scoreJobs } = args
  const { dataset, chartType, shouldSplit, allAthletes, rowCap, refLines, rules, wantsTeamEnvelope } =
    prepared
  if (!dataset || !chartType) return JSON.stringify({ error: 'Missing dataset or chartType' })
  const created: Array<{ id: string; title: string; values: string[] }> = []
  let cursor = readString(input.after)
  for (const job of scoreJobs) {
    if (shouldSplit) {
      const grouped = emitAddChartLineGroups({
        state,
        input,
        dataset,
        chartType,
        allAthletes,
        rowCap,
        refLines,
        metricTitle: job.title,
        values: job.values,
        afterCursor: cursor,
      })
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

export const emitSplitLineAddCharts = (args: {
  state: PremiumReportState
  input: Record<string, unknown>
  prepared: AddChartPrepared
}): string => {
  const { state, input, prepared } = args
  const {
    dataset,
    chartType,
    chartTitle,
    chartValues,
    allAthletes,
    rowCap,
    refLines,
    wantsTeamEnvelope,
  } = prepared
  if (!dataset || !chartType) return JSON.stringify({ error: 'Missing dataset or chartType' })
  const grouped = emitAddChartLineGroups({
    state,
    input,
    dataset,
    chartType,
    allAthletes,
    rowCap,
    refLines,
    metricTitle: chartTitle,
    values: chartValues,
    afterCursor: readString(input.after),
  })
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

export const emitSingleAddChart = (args: {
  state: PremiumReportState
  input: Record<string, unknown>
  prepared: AddChartPrepared
}): string => {
  const { state, input, prepared } = args
  let { dataset, chartType, chartValues } = prepared
  const { chartTitle, incoming, refLines, rowCap, rules } = prepared
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
}
