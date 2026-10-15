import {
  PREMIUM_CHART_PRESET,
  PREMIUM_RADAR_MAX_SERIES,
  PREMIUM_RADAR_MIN_METRICS,
  type PremiumChartPreset,
} from '#constants/premium_report.constants'
import type { PremiumDataset } from '#contracts/premium_report'
import { displayColumnLabel, relabelDatasetColumns } from '#services/premium_report/column_labels'
import {
  aggregateRowsByCategory,
  uniqueColumnCount,
} from '#services/premium_report/charts/dataset_transforms'
import {
  type ChartRefLines,
  pickCategoryColumn,
  pickSeriesGroupColumn,
  pickValueColumns,
  preferLineMetric,
  resolveSingleGrainLineMetrics,
} from '#services/premium_report/charts/chart_rules'
import type { EchartsOption } from '#services/premium_report/charts/echarts_types'
import { buildPresetChartOption } from '#services/premium_report/charts/echarts_options'
import {
  isOrdinalScore,
  pickDateColumn,
  sortDatasetByDate,
  toNumber,
} from '#services/premium_report/dataset_ops'
import type { AppLanguage } from '#utils/localize'

export type { ChartRefLines, ScoreChartJob } from '#services/premium_report/charts/chart_rules'
export type {
  EchartsAxis,
  EchartsGrid,
  EchartsLegend,
  EchartsOption,
  EchartsSeriesItem,
  EchartsTooltip,
} from '#services/premium_report/charts/echarts_types'

export {
  chartTypeFromOption,
  defaultScoreChartTitle,
  feasibleChartTypes,
  inferChartType,
  inferRefLines,
  isHollowMultiMetricChart,
  isIndividualEvolutionTitle,
  isInjuryRiskColumn,
  isPerformanceScoreColumn,
  isTeamAggregateSeriesName,
  isTeamMeanEvolutionTitle,
  wantsSquadEnvelopeTitle,
  pickCategoryColumn,
  pickSeriesGroupColumn,
  pickValueColumns,
  preferLineMetric,
  resolveSingleGrainLineMetrics,
  compatibleSubjectiveLineMetrics,
  scoreChartJobs,
  scoreIntentFromTitle,
} from '#services/premium_report/charts/chart_rules'

export {
  aggregateRowsByCategory,
  chunkAthletes,
  filterDatasetByAthletes,
  listDatasetAthletes,
  splitSeriesByScale,
  uniqueColumnCount,
} from '#services/premium_report/charts/dataset_transforms'

export { asEchartsOption } from '#services/premium_report/charts/echarts_types'

export {
  buildEchartsHeatmapOption,
  buildPresetChartOption,
  lineChartNeedsTimeAxisRepair,
  maybeAppendSquadRangeBand,
  rebuildLineChartFromRows,
  sanitizeChartOptionForPrint,
  stripSquadRangeBandSeries,
} from '#services/premium_report/charts/echarts_options'
export type { SubjectiveChartScale } from '#services/premium_report/charts/echarts_options'

const RADAR_SKIP_VALUE_RE = /^(n|count|samples?|rows?|unit|nb_.*|athletes?|players?)$/i

type RadarAthletePlan = {
  category: string
  values: string[]
  rows: Array<Record<string, unknown>>
}

export const planRadarAthleteRows = (
  labeled: PremiumDataset,
  category: string,
  values: string[],
  dateColumn?: string | null
): RadarAthletePlan | string => {
  const athleteCol = pickSeriesGroupColumn(labeled.columns)
  const radarCategory = athleteCol ?? category
  const skipNoise = (cols: string[]) =>
    cols.filter((col) => col !== dateColumn && !RADAR_SKIP_VALUE_RE.test(col.trim()))
  const populated = (cols: string[]) =>
    skipNoise(cols).filter((col) => labeled.rows.some((row) => toNumber(row[col]) != null))
  let radarValues = populated(values)
  if (radarValues.length < PREMIUM_RADAR_MIN_METRICS) {
    radarValues = populated(pickValueColumns(labeled, radarCategory))
  }
  if (radarValues.length < PREMIUM_RADAR_MIN_METRICS) {
    return JSON.stringify({
      error: `radar needs ≥${PREMIUM_RADAR_MIN_METRICS} numeric metrics (same scale family) and ≤${PREMIUM_RADAR_MAX_SERIES} series`,
      suggestion:
        'Radar is single-athlete only. Wellness axes (fetch_wellness_daily): mood_rating+energy_rating+body_soreness_rating+stress_rating. Sleep quality is on fetch_sleep_daily (quality_rating) — join first if needed. Multi-athlete profiles → bar. Top-N / 2–3 metrics → bar or table. Do not use n/count as a radar axis.',
      columns: labeled.columns,
    })
  }
  radarValues = radarValues.slice(0, 8)
  let radarRows = labeled.rows
  if (
    athleteCol &&
    (dateColumn || uniqueColumnCount(labeled, athleteCol) > PREMIUM_RADAR_MAX_SERIES)
  ) {
    radarRows = aggregateRowsByCategory(labeled.rows, athleteCol, radarValues)
  }
  const minPopulated = Math.min(PREMIUM_RADAR_MIN_METRICS, radarValues.length)
  radarRows = [...radarRows]
    .filter((row) => radarValues.filter((col) => toNumber(row[col]) != null).length >= minPopulated)
    .sort((left, right) => {
      const energy = (row: Record<string, unknown>) =>
        radarValues.reduce((sum, col) => sum + Math.abs(toNumber(row[col]) ?? 0), 0)
      return energy(right) - energy(left)
    })
  if (radarRows.length === 0) {
    return JSON.stringify({
      error: `radar needs ≥${PREMIUM_RADAR_MIN_METRICS} numeric metrics for one athlete`,
      suggestion: 'Filter to one athlete then radar, or use bar for squad profiles.',
      columns: labeled.columns,
    })
  }
  return { category: radarCategory, values: radarValues, rows: radarRows }
}

export const buildPresetFromDataset = (
  chartType: PremiumChartPreset,
  dataset: PremiumDataset,
  categoryArg?: string,
  valuesArg?: string[],
  refLines: ChartRefLines = 'none',
  language: AppLanguage = 'fr',
  title?: string
): EchartsOption | string => {
  const labeled = sortDatasetByDate(relabelDatasetColumns(dataset, language))
  const labelCtx = { units: dataset.units, labels: dataset.labels }
  const mapArg = (name?: string) =>
    name ? displayColumnLabel(name, language, labelCtx) : undefined
  const categoryMapped = mapArg(categoryArg)
  const valuesMapped = valuesArg?.map((value) => displayColumnLabel(value, language, labelCtx))

  if (chartType === PREMIUM_CHART_PRESET.HEATMAP) {
    const xCol =
      categoryMapped && labeled.columns.includes(categoryMapped)
        ? categoryMapped
        : labeled.columns.includes('x')
          ? 'x'
          : pickCategoryColumn(labeled)
    const yCol =
      valuesMapped?.find((col) => col !== xCol && labeled.columns.includes(col)) ??
      (labeled.columns.includes('y') ? 'y' : undefined)
    const valueCol =
      valuesMapped?.find((col) => col !== xCol && col !== yCol && labeled.columns.includes(col)) ??
      (labeled.columns.includes('r')
        ? 'r'
        : labeled.columns.find(
            (col) => col === 'Corrélation' || col === 'Correlation' || col === 'value'
          ))
    if (!yCol || !valueCol) {
      return JSON.stringify({
        error: 'heatmap needs x/y/r (from correlate mode=matrix)',
        columns: labeled.columns,
      })
    }
    const option = buildPresetChartOption({
      chartType: 'heatmap',
      category: xCol,
      values: [yCol, valueCol],
      rows: labeled.rows,
      refLines,
      language,
    })
    const series = Array.isArray(option.series) ? option.series[0] : null
    const data =
      series && typeof series === 'object' && !Array.isArray(series)
        ? (series as { data?: unknown }).data
        : null
    if (!Array.isArray(data) || data.length === 0) {
      return JSON.stringify({ error: 'heatmap has no finite correlation cells' })
    }
    return option
  }

  const dateColumn = pickDateColumn(labeled.columns)
  const groupColumn = pickSeriesGroupColumn(labeled.columns)
  const category =
    chartType === PREMIUM_CHART_PRESET.LINE && dateColumn
      ? dateColumn
      : pickCategoryColumn(labeled, categoryMapped)
  let values = pickValueColumns(labeled, category, valuesMapped?.length ? valuesMapped : undefined)
  if (chartType === PREMIUM_CHART_PRESET.LINE && dateColumn && values.length > 1) {
    const multiAthlete = Boolean(groupColumn && uniqueColumnCount(labeled, groupColumn) > 1)
    if (multiAthlete || /min|max|mean|enveloppe|envelope/i.test(title ?? '')) {
      values = preferLineMetric(values, { title })
    } else {
      values = resolveSingleGrainLineMetrics(values, labeled.rows, { title })
    }
  } else if (
    (chartType === PREMIUM_CHART_PRESET.BAR || chartType === PREMIUM_CHART_PRESET.DONUT) &&
    values.length > 1 &&
    !valuesMapped?.length
  ) {
    values = preferLineMetric(values, { title })
  }

  if (chartType === PREMIUM_CHART_PRESET.SCATTER) {
    if (values.length < 2) {
      return JSON.stringify({
        error: 'scatter needs two numeric columns',
        columns: labeled.columns,
      })
    }
    const [xCol, yCol] = values
    if (isOrdinalScore(labeled.rows, xCol!) || isOrdinalScore(labeled.rows, yCol!)) {
      return JSON.stringify({
        error:
          'Scatter is useless for discrete ordinal scores (e.g. CMJ 1-5). Use bar (by score group or top athletes) or a table with team mean.',
        suggestion:
          'Prefer continuous metrics for scatter (hmld_km, hsr_km, strain, distance). For discrete scores: bar chart or table.',
        columns: labeled.columns,
      })
    }
    return buildPresetChartOption({
      chartType: 'scatter',
      category,
      values: values.slice(0, 2),
      rows: labeled.rows,
      refLines,
      language,
    })
  }

  if (chartType === PREMIUM_CHART_PRESET.RADAR) {
    const planned = planRadarAthleteRows(labeled, category, values, dateColumn)
    if (typeof planned === 'string') return planned
    return buildPresetChartOption({
      chartType: 'radar',
      category: planned.category,
      values: planned.values,
      rows: planned.rows.slice(0, PREMIUM_RADAR_MAX_SERIES),
      refLines,
      language,
    })
  }

  if (chartType === PREMIUM_CHART_PRESET.DONUT) {
    return JSON.stringify({
      error: 'donut charts are not allowed in staff reports — use bar or table',
    })
  }
  if (chartType === PREMIUM_CHART_PRESET.BAR_LINE) {
    return JSON.stringify({
      error: 'bar-line (dual metric axis) is not allowed — use separate charts',
    })
  }
  if (values.length === 0) {
    return JSON.stringify({
      error: `${chartType} needs a numeric value column`,
      columns: labeled.columns,
      hint: 'Pass values=[numericCol] explicitly, or use a dataset with numeric metrics (filter emptied numbers / wrong id). Prefer bar/radar if the grain is ranking/profile.',
    })
  }
  return buildPresetChartOption({
    chartType,
    category,
    values,
    rows: labeled.rows,
    refLines,
    language,
  })
}
