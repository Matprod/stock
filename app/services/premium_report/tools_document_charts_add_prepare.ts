import {
  PREMIUM_CHART_PRESET,
  PREMIUM_LINE_MAX_ATHLETES,
  PREMIUM_REPORT_MAX_HEADING_LENGTH,
  isPremiumChartPreset,
  type PremiumChartPreset,
} from '#constants/premium_report.constants'
import { chartHintAsPreset } from '#constants/premium_report_intent'
import { chartDisplayRowCap, runVizGate } from '#services/premium_report/premium_report_viz_validator'
import { sanitizePlainObject } from '#services/premium_report/premium_report_document'
import {
  filterDatasetByAthletes,
  feasibleChartTypes,
  inferChartType,
  listDatasetAthletes,
  pickCategoryColumn,
  scoreChartJobs,
  uniqueColumnCount,
  type ChartRefLines,
  type ScoreChartJob,
} from '#services/premium_report/chart_presets'
import { pickDateColumn, readString, readStringList } from '#services/premium_report/dataset_ops'
import { resolveChartRules } from '#services/premium_report/charts/chart_rules'
import type { PremiumReportState } from '#services/premium_report/premium_report_tools'
import type { PremiumDataset } from '#contracts/premium_report'
import {
  coachAskedEveryPlayerLines,
  coachAskedTeamMeanEnvelope,
  acwrSeriesTooSparse,
  chartColumnFailFast,
  resolveToolDataset,
} from '#services/premium_report/tools_document_shared'

export type AddChartPrepared = {
  title: string
  chartType: PremiumChartPreset | undefined
  chartTypeRaw: string | undefined
  dataset: PremiumDataset | undefined
  athleteFilter: string[]
  incoming: Record<string, unknown> | undefined
  refLines: ChartRefLines
  rowCap: number
  rules: ReturnType<typeof resolveChartRules>
  isLine: boolean
  allAthletes: string[]
  scoreJobs: ScoreChartJob[] | null
  chartValues: string[]
  chartTitle: string
  everyPlayerLines: boolean
  wantsTeamEnvelope: boolean
  shouldSplit: boolean
}

export const prepareAddChart = (
  state: PremiumReportState,
  input: Record<string, unknown>
): string | AddChartPrepared => {
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
  const chartValues = scoreJobs?.[0]?.values ?? readStringList(input.values)
  const chartTitle = (scoreJobs?.[0]?.title ?? title).slice(0, PREMIUM_REPORT_MAX_HEADING_LENGTH)
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

  return {
    title,
    chartType,
    chartTypeRaw,
    dataset,
    athleteFilter,
    incoming,
    refLines,
    rowCap,
    rules,
    isLine,
    allAthletes,
    scoreJobs,
    chartValues,
    chartTitle,
    everyPlayerLines,
    wantsTeamEnvelope,
    shouldSplit,
  }
}
