import {
  PREMIUM_CHART_PRESET,
  PREMIUM_RADAR_MIN_METRICS,
  type PremiumChartPreset,
  type PremiumJevProvider,
} from '#constants/premium_report.constants'
import { pickAthleteColumn } from '#constants/premium_report_metrics'
import type { PremiumDataset } from '#contracts/premium_report'
import {
  isNumericColumn,
  uniqueColumnCount,
} from '#services/premium_report/charts/dataset_transforms'
import { asSeriesList, type EchartsOption } from '#services/premium_report/charts/echarts_types'
import {
  isAggregateCountColumn,
  isIdColumnName,
  isRatingLikeColumn,
  pickDateColumn,
  toNumber,
} from '#services/premium_report/dataset_ops'
import { elapsedSec, logPremiumTool } from '#services/premium_report/premium_report_log'
import type { AppLanguage } from '#utils/localize'

export type ChartRefLines = 'none' | 'mean' | 'mean_median' | 'full'

type ChartScoreIntent = 'perf' | 'injury' | 'both' | 'none'

type ChartLayoutKind = 'individual' | 'team_mean' | 'squad_envelope' | 'auto'

type ChartRulesJudgment = {
  scoreIntent: ChartScoreIntent
  layout: ChartLayoutKind
  refLines: ChartRefLines
  score: number
  provider: PremiumJevProvider
}

const LINE_METRIC_PREF = [
  /performance[_\s-]?score/i,
  /injury[_\s-]?risk/i,
  /acwr/i,
  /accel/i,
  /soreness|courbature|fatigue|energy|energie|wellness/i,
  /player[_\s-]?load/i,
  /\bdsl\b/i,
  /srpe/i,
  /total[_\s-]?distance/i,
  /distance/i,
]

const PERF_SCORE_COL_RE = /performance[_\s-]?score/i
const INJURY_SCORE_COL_RE = /injury[_\s-]?risk/i

export const isPerformanceScoreColumn = (name: string): boolean => PERF_SCORE_COL_RE.test(name)

export const isInjuryRiskColumn = (name: string): boolean => INJURY_SCORE_COL_RE.test(name)

export const scoreIntentFromTitle = (title: string): 'perf' | 'injury' | 'both' | 'none' => {
  const t = title.toLowerCase()
  const perf = /perf|performance/.test(t)
  const injury = /injury|blessure|risque/.test(t)
  if (perf && injury) return 'both'
  if (injury) return 'injury'
  if (perf) return 'perf'
  return 'none'
}

export const defaultScoreChartTitle = (kind: 'perf' | 'injury', language: AppLanguage): string =>
  kind === 'perf'
    ? language === 'fr'
      ? 'Score de performance'
      : 'Performance score'
    : language === 'fr'
      ? 'Score de risque de blessure'
      : 'Injury risk score'

export type ScoreChartJob = { values: string[]; title: string }

export const scoreChartJobs = (args: {
  columns: string[]
  requestedValues: string[]
  title: string
  chartType: string
  language: AppLanguage
  intentOverride?: 'perf' | 'injury' | 'both' | 'none'
}): ScoreChartJob[] | null => {
  if (
    args.chartType === PREMIUM_CHART_PRESET.SCATTER ||
    args.chartType === PREMIUM_CHART_PRESET.HEATMAP ||
    args.chartType === PREMIUM_CHART_PRESET.RADAR
  ) {
    return null
  }
  const perf = args.columns.find(isPerformanceScoreColumn)
  const inj = args.columns.find(isInjuryRiskColumn)
  if (!perf || !inj) return null
  const req = args.requestedValues
  const reqPerf = req.some(isPerformanceScoreColumn)
  const reqInj = req.some(isInjuryRiskColumn)
  if (req.length > 0 && !reqPerf && !reqInj) return null
  if (req.length > 0 && reqPerf !== reqInj) {
    const kind = reqPerf ? 'perf' : 'injury'
    return [
      {
        values: [reqPerf ? perf : inj],
        title: defaultScoreChartTitle(kind, args.language),
      },
    ]
  }
  const intent = args.intentOverride ?? scoreIntentFromTitle(args.title)
  if (intent === 'none') return null
  if (intent === 'perf') {
    return [{ values: [perf], title: defaultScoreChartTitle('perf', args.language) }]
  }
  if (intent === 'injury') {
    return [{ values: [inj], title: defaultScoreChartTitle('injury', args.language) }]
  }
  return [
    { values: [perf], title: defaultScoreChartTitle('perf', args.language) },
    { values: [inj], title: defaultScoreChartTitle('injury', args.language) },
  ]
}

export const pickSeriesGroupColumn = (columns: string[]): string | undefined =>
  pickAthleteColumn(columns) ??
  columns.find((column) => /^(poste|position)$/i.test(column)) ??
  columns.find((column) => /poste|position/i.test(column))

export const preferLineMetric = (
  values: string[],
  prefer?: { title?: string; column?: string }
): string[] => {
  if (values.length <= 1) return values
  if (
    isMeanMinMaxEnvelopeColumns(values) ||
    (prefer?.title && wantsSquadEnvelopeTitle(prefer.title) && values.length >= 2)
  ) {
    return values
  }
  if (prefer?.column) {
    const wanted = prefer.column.trim().toLowerCase()
    const hit = values.find((col) => col.trim().toLowerCase() === wanted)
    if (hit) return [hit]
    const byKind = isInjuryRiskColumn(prefer.column)
      ? values.find(isInjuryRiskColumn)
      : isPerformanceScoreColumn(prefer.column)
        ? values.find(isPerformanceScoreColumn)
        : undefined
    if (byKind) return [byKind]
  }
  const title = prefer?.title ?? ''
  const metricValues = values.filter((col) => !isAggregateCountColumn(col))
  const pool = metricValues.length ? metricValues : values
  if (/\bacwr\b|acute\s*[:=-]?\s*chronic/i.test(title)) {
    const acwr = pool.find((col) => /acwr/i.test(col))
    if (acwr) return [acwr]
  }
  if (/\btotal\b|cumul|\bsum\b/i.test(title)) {
    const sumCol = pool.find((col) => /_sum$/i.test(col))
    if (sumCol) return [sumCol]
    const loadCol = pool.find((col) => /srpe|session.?rpe|player.?load|\bdsl\b|internal.?load/i.test(col))
    if (loadCol) return [loadCol]
  }
  const perf = pool.find(isPerformanceScoreColumn)
  const inj = pool.find(isInjuryRiskColumn)
  if (perf && inj) {
    const intent = scoreIntentFromTitle(title)
    if (intent === 'injury') return [inj]
    if (intent === 'perf') return [perf]
  }
  for (const re of LINE_METRIC_PREF) {
    const hit = pool.find((col) => re.test(col))
    if (hit) return [hit]
  }
  return pool.slice(0, 1)
}

const subjectiveScaleFamily = (
  column: string,
  rows?: Array<Record<string, unknown>>
): 5 | 10 | 0 => {
  let max = 0
  for (const row of rows ?? []) {
    const n = toNumber(row[column])
    if (n != null && Number.isFinite(n) && n > max) max = n
  }
  if (max <= 0) return 5
  if (max <= 5.5) return 5
  if (max <= 10.5) return 10
  return 0
}

export const compatibleSubjectiveLineMetrics = (
  values: string[],
  rows?: Array<Record<string, unknown>>
): string[] => {
  const ratingCols = values.filter(isRatingLikeColumn)
  if (ratingCols.length < 2) return []
  const byFamily = new Map<number, string[]>()
  for (const col of ratingCols) {
    const family = subjectiveScaleFamily(col, rows)
    if (family === 0) continue
    const list = byFamily.get(family) ?? []
    list.push(col)
    byFamily.set(family, list)
  }
  let best: string[] = []
  for (const cols of byFamily.values()) {
    if (cols.length > best.length) best = cols
  }
  return best.length >= 2 ? best : []
}

export const resolveSingleGrainLineMetrics = (
  values: string[],
  rows?: Array<Record<string, unknown>>,
  prefer?: { title?: string; column?: string }
): string[] => {
  if (values.length <= 1) return values
  if (isMeanMinMaxEnvelopeColumns(values)) return values
  const compatible = compatibleSubjectiveLineMetrics(values, rows)
  if (compatible.length >= 2) return compatible
  return preferLineMetric(values, prefer)
}

export const inferRefLines = (args: {
  chartType?: string
  rowCount: number
  hasDate: boolean
  title?: string
}): ChartRefLines => {
  if (args.rowCount < 5) return 'none'
  if (args.chartType === 'heatmap' || args.chartType === 'scatter' || args.chartType === 'donut') {
    return 'none'
  }
  const title = args.title ?? ''
  const wantsBaseline =
    /moyenne|mean|\bavg\b|médiane|median|référence|reference|benchmark|vs\s+(équipe|team|groupe|squad)|compared\s+to/i.test(
      title
    )
  if (!wantsBaseline) return 'none'
  if (/médiane|median/i.test(title) && /moyenne|mean|\bavg\b/i.test(title)) return 'mean_median'
  if (/médiane|median/i.test(title)) return 'mean_median'
  return 'mean'
}

export const pickCategoryColumn = (dataset: PremiumDataset, preferred?: string): string => {
  const dateColumn = pickDateColumn(dataset.columns)
  const athleteColumn = pickAthleteColumn(dataset.columns)

  if (preferred && dataset.columns.includes(preferred)) {
    if (
      dateColumn &&
      athleteColumn &&
      preferred === athleteColumn &&
      uniqueColumnCount(dataset, athleteColumn) <= 1
    ) {
      return dateColumn
    }
    return preferred
  }

  if (athleteColumn && uniqueColumnCount(dataset, athleteColumn) > 1) return athleteColumn
  if (dateColumn) return dateColumn
  if (athleteColumn) return athleteColumn

  for (const column of ['poste', 'Poste', 'Activité', 'activity', 'Activity']) {
    if (dataset.columns.includes(column)) return column
  }
  return (
    dataset.columns.find(
      (column) => !isNumericColumn(dataset, column) && !isIdColumnName(column)
    ) ??
    dataset.columns[0] ??
    'Joueur'
  )
}

export const pickValueColumns = (
  dataset: PremiumDataset,
  category: string,
  requested?: string[]
): string[] => {
  if (requested?.length) {
    const kept = requested.filter(
      (column) => dataset.columns.includes(column) && !isAggregateCountColumn(column)
    )
    if (kept.length) return kept
  }
  return dataset.columns.filter(
    (column) =>
      column !== category &&
      !isAggregateCountColumn(column) &&
      !isIdColumnName(column) &&
      isNumericColumn(dataset, column)
  )
}

export const isTeamAggregateSeriesName = (name: string): boolean =>
  /équipe|equipe|\bteam\b|\(moy\.?\)|\(mean\)|\(avg\)|\(Σ\)|\(sum\)|moyenne\b|squad\b|_mean\b|_sum\b|score\s*\(\s*mean\s*\)/i.test(
    name
  )

export const isEnvelopeStatSeriesName = (name: string, stat: 'min' | 'max' | 'mean'): boolean => {
  if (stat === 'mean') return isTeamAggregateSeriesName(name)
  return new RegExp(
    `(^|[\\s_(,-])${stat}(\\b|[)\\]]|$)|(?:squad|équipe|equipe|team)\\s*${stat}|${stat}\\s*(?:équipe|equipe|squad|team)`,
    'i'
  ).test(name)
}

export const isMeanMinMaxEnvelopeColumns = (columns: string[]): boolean => {
  if (columns.length < 2) return false
  const hasMean = columns.some(
    (col) => isEnvelopeStatSeriesName(col, 'mean') || /_mean$/i.test(col)
  )
  const hasMin = columns.some((col) => isEnvelopeStatSeriesName(col, 'min') || /_min$/i.test(col))
  const hasMax = columns.some((col) => isEnvelopeStatSeriesName(col, 'max') || /_max$/i.test(col))
  return hasMean && hasMin && hasMax
}

export const isIndividualEvolutionTitle = (chartTitle: string): boolean =>
  /\bindividu|\bindividual\b|\bplayer\b.{0,24}(evol|trend|score)|\bjoueur\b.{0,24}(évol|evol|score)|évolutions?\s+individ|\bindividual\s+score|par\s+joueur|per\s+player|spaghetti/i.test(
    chartTitle
  )

export const wantsSquadEnvelopeTitle = (chartTitle: string): boolean =>
  /\b(enveloppe|envelope|min\s*[-–—]\s*max|minmax|±\s*min|bande\s+(min|équipe|squad)|squad\s*range|range\s*band)\b/i.test(
    chartTitle
  )

export const isTeamMeanEvolutionTitle = (chartTitle: string): boolean =>
  /\b(moyenne|mean|avg|équipe|equipe|squad|team)\b/i.test(chartTitle) &&
  !isIndividualEvolutionTitle(chartTitle)

export const isHollowMultiMetricChart = (title: string, option: EchartsOption): boolean => {
  const t = title.toLowerCase()
  const claimsMulti =
    /concordance/.test(t) ||
    (t.includes('×') && (t.match(/×/g) ?? []).length >= 1) ||
    /\sx\s.+\sx\s/i.test(t) ||
    (/\b(vs|versus)\b/.test(t) && /line|évolution|evolution|temporel/i.test(t))
  if (!claimsMulti) return false
  const named = asSeriesList(option.series).filter((entry) => {
    const type = String(entry.type ?? 'line')
    if (type === 'custom') return false
    const name = String(entry.name ?? '')
    return !name.startsWith('_')
  })
  return named.length < 2
}

export const inferChartType = (dataset: PremiumDataset): PremiumChartPreset => {
  const cols = dataset.columns
  const hasCorrShape =
    cols.includes('x') && cols.includes('y') && (cols.includes('r') || cols.includes('correlation'))
  if (hasCorrShape) return PREMIUM_CHART_PRESET.HEATMAP

  const category = pickCategoryColumn(dataset)
  const values = pickValueColumns(dataset, category)
  const hasDate = cols.some((c) => /date/i.test(c))
  const nCats = new Set(dataset.rows.map((row) => String(row[category] ?? ''))).size

  if (hasDate) {
    if (values.length >= 2) return PREMIUM_CHART_PRESET.BAR_LINE
    return PREMIUM_CHART_PRESET.LINE
  }
  if (values.length >= PREMIUM_RADAR_MIN_METRICS && nCats === 1) {
    return PREMIUM_CHART_PRESET.RADAR
  }
  if (values.length >= 2) {
    if (/joueur|player|name|athlete/i.test(category)) return PREMIUM_CHART_PRESET.BAR
    return PREMIUM_CHART_PRESET.SCATTER
  }
  return PREMIUM_CHART_PRESET.BAR
}

export const feasibleChartTypes = (dataset: PremiumDataset): PremiumChartPreset[] => {
  const cols = dataset.columns
  const hasCorrShape =
    cols.includes('x') && cols.includes('y') && (cols.includes('r') || cols.includes('correlation'))
  if (hasCorrShape) return [PREMIUM_CHART_PRESET.HEATMAP]

  const category = pickCategoryColumn(dataset)
  const values = pickValueColumns(dataset, category)
  const hasDate = Boolean(pickDateColumn(cols))
  const nCats = new Set(dataset.rows.map((row) => String(row[category] ?? ''))).size
  const out: PremiumChartPreset[] = [PREMIUM_CHART_PRESET.BAR]

  if (hasDate) {
    out.push(PREMIUM_CHART_PRESET.LINE)
    if (values.length >= 2) out.push(PREMIUM_CHART_PRESET.BAR_LINE)
  }
  if (values.length >= 2) {
    out.push(PREMIUM_CHART_PRESET.SCATTER)
    if (!hasDate) out.push(PREMIUM_CHART_PRESET.BAR_LINE)
  }
  if (values.length >= PREMIUM_RADAR_MIN_METRICS && nCats === 1) {
    out.push(PREMIUM_CHART_PRESET.RADAR)
  }
  if (values.length >= 1 && nCats >= 2 && nCats <= 12) out.push(PREMIUM_CHART_PRESET.DONUT)

  return [...new Set(out)]
}

export const chartTypeFromOption = (option: EchartsOption): PremiumChartPreset | undefined => {
  const types = asSeriesList(option.series)
    .map((item) => (typeof item.type === 'string' ? item.type : undefined))
    .filter((type): type is string => Boolean(type))
  if (types.length === 0) return undefined
  const hasBar = types.includes('bar')
  const hasLine = types.includes('line')
  if (hasBar && hasLine) return PREMIUM_CHART_PRESET.BAR_LINE
  if (types.includes('heatmap')) return PREMIUM_CHART_PRESET.HEATMAP
  if (types.includes('scatter')) return PREMIUM_CHART_PRESET.SCATTER
  if (types.includes('radar')) return PREMIUM_CHART_PRESET.RADAR
  if (types.includes('pie')) return PREMIUM_CHART_PRESET.DONUT
  if (types.every((type) => type === 'line')) return PREMIUM_CHART_PRESET.LINE
  if (types.every((type) => type === 'bar')) return PREMIUM_CHART_PRESET.BAR
  return undefined
}

export const isSquadRangeSeriesName = (name: string): boolean =>
  /min\s*[-–—]\s*max|min.?max|squad.?range|équipe.?min|team.?min|enveloppe|squad\s*\(\s*min/i.test(
    name
  ) || name.startsWith('_squad_range')

export const looksLikeDateLabel = (value: unknown): boolean => {
  const raw = String(value ?? '').trim()
  return /^\d{4}-\d{2}-\d{2}/.test(raw) || /^\d{1,2}[/.-]\d{1,2}([/.-]\d{2,4})?$/.test(raw)
}

export const stampMaunaChartLayout = <T extends Record<string, unknown>>(
  option: T,
  layout: ChartLayoutKind
): T => ({ ...option, maunaLayout: layout })

const heuristicChartRules = (args: {
  title: string
  chartType?: string
  rowCount: number
  hasDate: boolean
}): ChartRulesJudgment => {
  const title = args.title
  let layout: ChartLayoutKind = 'auto'
  if (isIndividualEvolutionTitle(title)) layout = 'individual'
  else if (wantsSquadEnvelopeTitle(title)) layout = 'squad_envelope'
  else if (isTeamMeanEvolutionTitle(title)) layout = 'team_mean'

  return {
    scoreIntent: scoreIntentFromTitle(title),
    layout,
    refLines: inferRefLines({
      chartType: args.chartType,
      rowCount: args.rowCount,
      hasDate: args.hasDate,
      title,
    }),
    score: 1,
    provider: 'heuristic',
  }
}

export const resolveChartRules = (args: {
  request: string
  title: string
  language: AppLanguage
  chartType?: string
  rowCount?: number
  hasDate?: boolean
  columns?: string[]
}): ChartRulesJudgment => {
  const started = Date.now()
  const judgment = heuristicChartRules({
    title: args.title,
    chartType: args.chartType,
    rowCount: args.rowCount ?? 0,
    hasDate: Boolean(args.hasDate),
  })
  logPremiumTool({
    tool: 'chart_rules',
    ok: true,
    durationSec: elapsedSec(started),
    detail: `${judgment.scoreIntent}|${judgment.layout}|${judgment.refLines}`,
  })
  return judgment
}
