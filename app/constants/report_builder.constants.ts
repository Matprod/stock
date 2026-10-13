import { METRIC_AGGREGATION_METHOD } from '#constants/metrics.constants'
import type { MetricAggregationMethod } from '#constants/metrics.constants'
import { SUBJECTIVE_VARIABLE_DOMAIN } from '#contracts/subjective_variable'
import type { SubjectiveVariableDomain } from '#contracts/subjective_variable'

export const REPORT_BLOC_TYPE = {
  LINE_CHART: 'graph:line-chart',
  BAR_CHART: 'graph:bar-chart',
  PIE_CHART: 'graph:pie-chart',
  KPI: 'kpi',
  TABLE: 'table',
  TEXT: 'text',
} as const

export type ReportBlocType = (typeof REPORT_BLOC_TYPE)[keyof typeof REPORT_BLOC_TYPE]

export const REPORT_BLOC_TYPES = Object.values(REPORT_BLOC_TYPE) as ReportBlocType[]

export const REPORT_BLOC_SPLIT = {
  VARIABLE: 'variable',
  ATHLETE: 'athlete',
} as const

export type ReportBlocSplit = (typeof REPORT_BLOC_SPLIT)[keyof typeof REPORT_BLOC_SPLIT]

export const REPORT_BLOC_SPLITS = Object.values(REPORT_BLOC_SPLIT) as ReportBlocSplit[]

export const REPORT_MAX_COMPARE_ATHLETES = 8

export const REPORT_MAX_COMPARE_VARIABLES = 4

export const REPORT_MAX_DAILY_BAR_POINTS = 16

const BAR_COMPARE_BY_POINTS = [
  { maxPoints: 8, maxAthletes: 8 },
  { maxPoints: 16, maxAthletes: 6 },
] as const

const BAR_COMPARE_BY_POINTS_FALLBACK = 4

export type BarCompareOptions = {
  singleValue?: boolean
}

const dayCountInRange = (from: string, to: string): number => {
  const start = Date.parse(`${from}T00:00:00.000Z`)
  const end = Date.parse(`${to}T00:00:00.000Z`)
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return 1
  return Math.floor((end - start) / 86_400_000) + 1
}

const barAxisPointCount = (from: string, to: string): number => {
  const days = dayCountInRange(from, to)
  if (days <= REPORT_MAX_DAILY_BAR_POINTS) return days
  return Math.max(1, Math.ceil(days / 7))
}

export const maxBarCompareAthletes = (
  from: string,
  to: string,
  options?: BarCompareOptions
): number => {
  const points = options?.singleValue ? 1 : barAxisPointCount(from, to)
  return (
    BAR_COMPARE_BY_POINTS.find((tier) => points <= tier.maxPoints)?.maxAthletes ??
    BAR_COMPARE_BY_POINTS_FALLBACK
  )
}

export const maxCompareAthletesFor = (
  type: ReportBlocType,
  from: string,
  to: string,
  options?: BarCompareOptions
): number => {
  if (type === REPORT_BLOC_TYPE.KPI || type === REPORT_BLOC_TYPE.TEXT) {
    return Number.POSITIVE_INFINITY
  }
  if (type === REPORT_BLOC_TYPE.BAR_CHART) {
    return maxBarCompareAthletes(from, to, options)
  }
  return REPORT_MAX_COMPARE_ATHLETES
}
export const REPORT_MAX_SERIES_SOURCES = 8

export const REPORT_MAX_TIME_SERIES_CURVES = 12

export const REPORT_TEXT_MAX_LENGTH = 4000

export const REPORT_HEX_COLOR = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/

export const parseReportColor = (value: string | undefined): string | undefined => {
  const trimmed = value?.trim()
  if (!trimmed || !REPORT_HEX_COLOR.test(trimmed)) return undefined
  if (trimmed.length === 4) {
    const [, r, g, b] = trimmed
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase()
  }
  return trimmed.toLowerCase()
}

export const REPORT_CONVERT_UNIT = {
  SECOND: 's',
  MINUTE: 'min',
  HOUR: 'h',
  METER: 'm',
  KILOMETER: 'km',
} as const

export type ReportConvertUnit = (typeof REPORT_CONVERT_UNIT)[keyof typeof REPORT_CONVERT_UNIT]

export const REPORT_CONVERT_UNITS = Object.values(REPORT_CONVERT_UNIT) as ReportConvertUnit[]

export const isReportConvertUnit = (value: string): value is ReportConvertUnit =>
  REPORT_CONVERT_UNITS.includes(value as ReportConvertUnit)

export const REPORT_PATCH_OP = {
  ADD_BLOC: 'addBloc',
  UPDATE_BLOC: 'updateBloc',
  REMOVE_BLOC: 'removeBloc',
  UPDATE_SERIES: 'updateSeries',
  SET_THEME: 'setTheme',
} as const

export type ReportPatchOp = (typeof REPORT_PATCH_OP)[keyof typeof REPORT_PATCH_OP]

export const REPORT_PATCH_OPS = Object.values(REPORT_PATCH_OP) as ReportPatchOp[]

export const isReportTextBloc = (type: ReportBlocType): boolean => type === REPORT_BLOC_TYPE.TEXT

export const REPORT_LINE_DASH = {
  SOLID: 'solid',
  DASHED: 'dashed',
  DOTTED: 'dotted',
} as const

export type ReportLineDash = (typeof REPORT_LINE_DASH)[keyof typeof REPORT_LINE_DASH]

export const REPORT_LINE_DASHES = Object.values(REPORT_LINE_DASH) as ReportLineDash[]

export const isReportLineDash = (value: string): value is ReportLineDash =>
  REPORT_LINE_DASHES.includes(value as ReportLineDash)

export const REPORT_LINE_DASH_PATTERN: Record<ReportLineDash, number[] | undefined> = {
  solid: undefined,
  dashed: [6, 4],
  dotted: [2, 3],
}

export const parseReportLineDash = (value: string | undefined): ReportLineDash | undefined => {
  if (!value?.trim()) return undefined
  const key = value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
  if (isReportLineDash(key)) return key
  if (key === 'plein' || key === 'continue') return REPORT_LINE_DASH.SOLID
  if (
    key === 'dot' ||
    key === 'dots' ||
    key.includes('pointille') ||
    key.includes('dotted')
  ) {
    return REPORT_LINE_DASH.DOTTED
  }
  if (key === 'dash' || key === 'tiret' || key === 'tirets' || key.includes('dashed')) {
    return REPORT_LINE_DASH.DASHED
  }
  return undefined
}

export const REPORT_CHATBOT_PROMPT_MAX = 8000

export const REPORT_CHATBOT_PROMPT_TITLE = 'chatbot-report-generator'

export const REPORT_CHATBOT_MODEL_ID = 'eu.anthropic.claude-haiku-4-5-20251001-v1:0'

export const REPORT_CHATBOT_HISTORY_MAX = 20

export const REPORT_STRUCTURE_MAX_BLOCS = 40

export const REPORT_CHATBOT_MAX_TOKENS = 8192

export const REPORT_TIME_SERIES_POINTS = 96

export const REPORT_SERIES_OP = {
  IDENTITY: 'identity',
  SUM: 'sum',
  SUB: 'sub',
  MUL: 'mul',
  DIV: 'div',
} as const

export type ReportSeriesOp = (typeof REPORT_SERIES_OP)[keyof typeof REPORT_SERIES_OP]

export const REPORT_SERIES_OPS = Object.values(REPORT_SERIES_OP) as ReportSeriesOp[]

export const REPORT_BINARY_SERIES_OPS = [
  REPORT_SERIES_OP.SUB,
  REPORT_SERIES_OP.MUL,
  REPORT_SERIES_OP.DIV,
] as const

export type ReportBinarySeriesOp = (typeof REPORT_BINARY_SERIES_OPS)[number]

export const REPORT_FORMULA_ID = {
  MEAN: 'mean',
  MEDIAN: 'median',
  MIN: 'min',
  MAX: 'max',
  SUM: 'sum',
  SD: 'sd',
  CV: 'cv',
  P25: 'p25',
  P75: 'p75',
  P90: 'p90',
  P95: 'p95',
  MA: 'ma',
  MEDIAN_MA: 'median_ma',
  EWMA: 'ewma',
  CUMULATIVE: 'cumulative',
  ACWR_MA: 'acwr_ma',
  ACWR_EWMA: 'acwr_ewma',
  MONOTONY: 'monotony',
  STRAIN: 'strain',
  ZSCORE: 'zscore',
  PCT_BASELINE: 'pct_baseline',
  DELTA_PCT: 'delta_pct',
} as const

export type ReportFormulaId = (typeof REPORT_FORMULA_ID)[keyof typeof REPORT_FORMULA_ID]

export const REPORT_FORMULA_IDS = Object.values(REPORT_FORMULA_ID) as ReportFormulaId[]

export const REPORT_FORMULA_WINDOW_DEFAULTS = [7, 14, 28] as const

export const REPORT_VARIABLE_PREFIX = {
  SPORT_ACTIVITY: 'sportActivity',
  PERIOD_METRIC: 'periodMetric',
  HEALTH: 'health',
  HEALTH_METRIC: 'healthMetric',
  SLEEP: 'sleep',
  SLEEP_METRIC: 'sleepMetric',
  DAY_METRIC: 'dayMetric',
  BIOMARKER: 'biomarker',
  VALD: 'vald',
  TIME_SERIES: 'timeSeries',
  DERIVED: 'derived',
  INSIGHT: 'insight',
} as const

export type ReportVariablePrefix =
  (typeof REPORT_VARIABLE_PREFIX)[keyof typeof REPORT_VARIABLE_PREFIX]

export const REPORT_VARIABLE_PREFIXES = Object.values(
  REPORT_VARIABLE_PREFIX
) as ReportVariablePrefix[]

export const REPORT_CATALOG_GROUP = {
  SPORT_ACTIVITY: 'sportActivity',
  PERIOD_METRIC: 'periodMetric',
  HEALTH: 'health',
  SLEEP: 'sleep',
  DAY_METRIC: 'dayMetric',
  BIOMARKER: 'biomarker',
  VALD: 'vald',
  SUBJECTIVE: 'subjective',
  TIME_SERIES: 'timeSeries',
  DERIVED: 'derived',
  INSIGHT: 'insight',
} as const

export type ReportCatalogGroup = (typeof REPORT_CATALOG_GROUP)[keyof typeof REPORT_CATALOG_GROUP]

export const SUBJECTIVE_DOMAIN_TO_PREFIX: Record<SubjectiveVariableDomain, ReportVariablePrefix> = {
  [SUBJECTIVE_VARIABLE_DOMAIN.SPORT_ACTIVITY]: REPORT_VARIABLE_PREFIX.SPORT_ACTIVITY,
  [SUBJECTIVE_VARIABLE_DOMAIN.HEALTH_RATING]: REPORT_VARIABLE_PREFIX.HEALTH,
  [SUBJECTIVE_VARIABLE_DOMAIN.HEALTH_METRIC]: REPORT_VARIABLE_PREFIX.HEALTH_METRIC,
  [SUBJECTIVE_VARIABLE_DOMAIN.SLEEP]: REPORT_VARIABLE_PREFIX.SLEEP,
}

export type ReportColumnDefinition = {
  field: string
  name: string
  description: string
  unit: string | null
  aggregation: MetricAggregationMethod
}

export const SPORT_ACTIVITY_REPORT_COLUMNS: ReportColumnDefinition[] = [
  {
    field: 'durationSeconds',
    name: 'Duration',
    description: 'Activity duration',
    unit: 'h',
    aggregation: METRIC_AGGREGATION_METHOD.SUM,
  },
  {
    field: 'distance',
    name: 'Distance',
    description: 'Activity distance',
    unit: 'm',
    aggregation: METRIC_AGGREGATION_METHOD.SUM,
  },
  {
    field: 'speed',
    name: 'Speed',
    description: 'Average speed',
    unit: 'm/s',
    aggregation: METRIC_AGGREGATION_METHOD.AVERAGE,
  },
  {
    field: 'elevation',
    name: 'Elevation',
    description: 'Elevation gain',
    unit: 'm',
    aggregation: METRIC_AGGREGATION_METHOD.SUM,
  },
  {
    field: 'elevationDescent',
    name: 'Elevation descent',
    description: 'Elevation loss',
    unit: 'm',
    aggregation: METRIC_AGGREGATION_METHOD.SUM,
  },
  {
    field: 'power',
    name: 'Power',
    description: 'Average power',
    unit: 'W',
    aggregation: METRIC_AGGREGATION_METHOD.AVERAGE,
  },
  {
    field: 'averagedBpm',
    name: 'Average HR',
    description: 'Average heart rate',
    unit: 'bpm',
    aggregation: METRIC_AGGREGATION_METHOD.AVERAGE,
  },
  {
    field: 'fcMax',
    name: 'Max HR',
    description: 'Maximum heart rate',
    unit: 'bpm',
    aggregation: METRIC_AGGREGATION_METHOD.MAX,
  },
  {
    field: 'rpe',
    name: 'RPE',
    description: 'Rate of perceived exertion',
    unit: null,
    aggregation: METRIC_AGGREGATION_METHOD.AVERAGE,
  },
  {
    field: 'fitnessLevel',
    name: 'Fitness level',
    description: 'Fitness level of the activity',
    unit: null,
    aggregation: METRIC_AGGREGATION_METHOD.AVERAGE,
  },
  {
    field: 'cardioRespiratory',
    name: 'Cardio-respiratory',
    description: 'Cardio-respiratory difficulty',
    unit: null,
    aggregation: METRIC_AGGREGATION_METHOD.AVERAGE,
  },
  {
    field: 'muscularDifficulty',
    name: 'Muscular difficulty',
    description: 'Muscular difficulty of the activity',
    unit: null,
    aggregation: METRIC_AGGREGATION_METHOD.AVERAGE,
  },
  {
    field: 'fatigueLevel',
    name: 'Fatigue level',
    description: 'Fatigue level of the activity',
    unit: null,
    aggregation: METRIC_AGGREGATION_METHOD.AVERAGE,
  },
  {
    field: 'pleasureLevel',
    name: 'Pleasure level',
    description: 'Pleasure level of the activity',
    unit: null,
    aggregation: METRIC_AGGREGATION_METHOD.AVERAGE,
  },
  {
    field: 'activeCalories',
    name: 'Active calories',
    description: 'Active calories burned',
    unit: 'kcal',
    aggregation: METRIC_AGGREGATION_METHOD.SUM,
  },
  {
    field: 'cadence',
    name: 'Cadence',
    description: 'Average cadence',
    unit: 'rpm',
    aggregation: METRIC_AGGREGATION_METHOD.AVERAGE,
  },
  {
    field: 'trainingLoad',
    name: 'Training load',
    description: 'Training load of the activity',
    unit: null,
    aggregation: METRIC_AGGREGATION_METHOD.SUM,
  },
]

export const HEALTH_REPORT_COLUMNS: ReportColumnDefinition[] = [
  {
    field: 'energyRating',
    name: 'Energy',
    description: 'Daily energy rating',
    unit: null,
    aggregation: METRIC_AGGREGATION_METHOD.AVERAGE,
  },
  {
    field: 'moodRating',
    name: 'Mood',
    description: 'Daily mood rating',
    unit: null,
    aggregation: METRIC_AGGREGATION_METHOD.AVERAGE,
  },
  {
    field: 'stressRating',
    name: 'Stress',
    description: 'Daily stress rating',
    unit: null,
    aggregation: METRIC_AGGREGATION_METHOD.AVERAGE,
  },
  {
    field: 'wellbeingRating',
    name: 'Wellbeing',
    description: 'Daily wellbeing rating',
    unit: null,
    aggregation: METRIC_AGGREGATION_METHOD.AVERAGE,
  },
  {
    field: 'bodySorenessRating',
    name: 'Body soreness',
    description: 'Daily body soreness rating',
    unit: null,
    aggregation: METRIC_AGGREGATION_METHOD.AVERAGE,
  },
]

export const SLEEP_REPORT_COLUMNS: ReportColumnDefinition[] = [
  {
    field: 'qualityRating',
    name: 'Sleep quality',
    description: 'Sleep quality rating',
    unit: null,
    aggregation: METRIC_AGGREGATION_METHOD.AVERAGE,
  },
  {
    field: 'durationHours',
    name: 'Sleep duration',
    description: 'Sleep duration in hours',
    unit: 'h',
    aggregation: METRIC_AGGREGATION_METHOD.AVERAGE,
  },
  {
    field: 'sleepEfficiencyPercentage',
    name: 'Sleep efficiency',
    description: 'Sleep efficiency percentage',
    unit: '%',
    aggregation: METRIC_AGGREGATION_METHOD.AVERAGE,
  },
  {
    field: 'sleepConsistencyPercentage',
    name: 'Sleep consistency',
    description: 'Sleep consistency percentage',
    unit: '%',
    aggregation: METRIC_AGGREGATION_METHOD.AVERAGE,
  },
  {
    field: 'totalSlowWaveSleepTimeMilli',
    name: 'Slow wave sleep',
    description: 'Slow wave sleep duration',
    unit: 'h',
    aggregation: METRIC_AGGREGATION_METHOD.AVERAGE,
  },
  {
    field: 'totalRemSleepTimeMilli',
    name: 'REM sleep',
    description: 'REM sleep duration',
    unit: 'h',
    aggregation: METRIC_AGGREGATION_METHOD.AVERAGE,
  },
  {
    field: 'totalInBedTimeMilli',
    name: 'Time in bed',
    description: 'Total time in bed',
    unit: 'h',
    aggregation: METRIC_AGGREGATION_METHOD.AVERAGE,
  },
  {
    field: 'totalAwakeTimeMilli',
    name: 'Time awake',
    description: 'Total awake time during sleep',
    unit: 'h',
    aggregation: METRIC_AGGREGATION_METHOD.AVERAGE,
  },
  {
    field: 'needFromSleepDebtMilli',
    name: 'Sleep debt',
    description: 'Need from sleep debt',
    unit: 'h',
    aggregation: METRIC_AGGREGATION_METHOD.AVERAGE,
  },
]

export const TIME_SERIES_REPORT_COLUMNS: ReportColumnDefinition[] = [
  {
    field: 'HEART_RATE',
    name: 'Heart rate (series)',
    description: 'Intra-session heart rate',
    unit: 'bpm',
    aggregation: METRIC_AGGREGATION_METHOD.AVERAGE,
  },
  {
    field: 'SPEED_METERS_PER_SECOND',
    name: 'Speed (series)',
    description: 'Intra-session speed',
    unit: 'm/s',
    aggregation: METRIC_AGGREGATION_METHOD.AVERAGE,
  },
  {
    field: 'TOTAL_DISTANCE_IN_METERS',
    name: 'Distance (series)',
    description: 'Intra-session distance',
    unit: 'm',
    aggregation: METRIC_AGGREGATION_METHOD.AVERAGE,
  },
  {
    field: 'ELEVATION_IN_METERS',
    name: 'Elevation (series)',
    description: 'Intra-session elevation',
    unit: 'm',
    aggregation: METRIC_AGGREGATION_METHOD.AVERAGE,
  },
  {
    field: 'POWER_IN_WATTS',
    name: 'Power (series)',
    description: 'Intra-session power',
    unit: 'W',
    aggregation: METRIC_AGGREGATION_METHOD.AVERAGE,
  },
  {
    field: 'STEPS_PER_MINUTE',
    name: 'Cadence (series)',
    description: 'Intra-session step cadence',
    unit: 'spm',
    aggregation: METRIC_AGGREGATION_METHOD.AVERAGE,
  },
  {
    field: 'BIKE_CADENCE_IN_RPM',
    name: 'Bike cadence (series)',
    description: 'Intra-session bike cadence',
    unit: 'rpm',
    aggregation: METRIC_AGGREGATION_METHOD.AVERAGE,
  },
]

export const REPORT_TIME_SERIES_TYPES = TIME_SERIES_REPORT_COLUMNS.map((column) => column.field)

export const DERIVED_REPORT_COLUMNS: ReportColumnDefinition[] = [
  {
    field: 'performanceScore',
    name: 'Performance score',
    description: 'Daily performance score (0–100)',
    unit: null,
    aggregation: METRIC_AGGREGATION_METHOD.AVERAGE,
  },
  {
    field: 'injuryRiskScore',
    name: 'Injury risk score',
    description: 'Daily injury risk score (0–100)',
    unit: null,
    aggregation: METRIC_AGGREGATION_METHOD.AVERAGE,
  },
  {
    field: 'newInjuries',
    name: 'New injuries',
    description: 'Injuries that started that day. KPI is the total in the selected period',
    unit: null,
    aggregation: METRIC_AGGREGATION_METHOD.SUM,
  },
  {
    field: 'injuryDays',
    name: 'Injury days',
    description:
      'Athletes currently injured that day. Line/bar is the injured roster; KPI is athlete-days',
    unit: null,
    aggregation: METRIC_AGGREGATION_METHOD.SUM,
  },
  {
    field: 'injuryLog',
    name: 'Injury log',
    description:
      'One row per injury: player, type, location, start and end dates. Use a Table block',
    unit: null,
    aggregation: METRIC_AGGREGATION_METHOD.SUM,
  },
]

export const DERIVED_DAY_SCORE_FIELDS = ['performanceScore', 'injuryRiskScore'] as const

export const DERIVED_INJURY_FIELDS = ['newInjuries', 'injuryDays'] as const

export const DERIVED_TABLE_FIELDS = ['injuryLog'] as const

export const INJURY_LOG_COLUMNS = [
  { key: 'player', label: 'Player' },
  { key: 'injury', label: 'Injury' },
  { key: 'location', label: 'Location' },
  { key: 'from', label: 'From' },
  { key: 'to', label: 'To' },
  { key: 'status', label: 'Status' },
  { key: 'context', label: 'Context' },
] as const

export const REPORT_CHART_COLORS = [
  '#2563eb',
  '#16a34a',
  '#ea580c',
  '#9333ea',
  '#0891b2',
  '#dc2626',
  '#ca8a04',
  '#4f46e5',
] as const
