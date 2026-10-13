export const PREMIUM_BLOCK_TYPE = {
  HEADING: 'heading',
  TEXT: 'text',
  CHART: 'chart',
  TABLE: 'table',
} as const

export type PremiumBlockType = (typeof PREMIUM_BLOCK_TYPE)[keyof typeof PREMIUM_BLOCK_TYPE]

export const PREMIUM_BLOCK_TYPES = Object.values(PREMIUM_BLOCK_TYPE) as PremiumBlockType[]

export const PREMIUM_REPORT_PROMPT_TITLE = 'premium-report-generator'

export const PREMIUM_REPORT_MODEL_ID = 'eu.anthropic.claude-sonnet-4-5-20250929-v1:0'

export const PREMIUM_REPORT_INPUT_USD_PER_MTOK = 3

export const PREMIUM_REPORT_OUTPUT_USD_PER_MTOK = 15

export const PREMIUM_REPORT_CACHE_READ_USD_PER_MTOK = 0.3

export const PREMIUM_REPORT_CACHE_WRITE_USD_PER_MTOK = 3.75

export const PREMIUM_REPORT_MAX_ITERATIONS = 14

export const PREMIUM_REPORT_FORCE_ANSWER_AT = 12

export const PREMIUM_REPORT_MAX_TOKENS = 8192

export const PREMIUM_REPORT_PROMPT_MAX = 8000

export const PREMIUM_REPORT_HISTORY_MAX = 20

export const PREMIUM_REPORT_MAX_BLOCKS = 48

export const PREMIUM_REPORT_MAX_CHARTS = 16

export const PREMIUM_REPORT_MAX_TEXT_LENGTH = 8000

export const PREMIUM_REPORT_MAX_HEADING_LENGTH = 200

export const PREMIUM_REPORT_MAX_TABLE_ROWS = 40

export const PREMIUM_REPORT_MAX_TABLE_COLS = 14

export const PREMIUM_REPORT_MAX_CHART_ROWS = 62

export const PREMIUM_REPORT_MAX_BAR_ROWS = 20

export const PREMIUM_LINE_MAX_ATHLETES = 5

export const PREMIUM_RADAR_MIN_METRICS = 4

export const PREMIUM_RADAR_MAX_SERIES = 1

export const PREMIUM_RADAR_MAX_CHARTS = 5

export const PREMIUM_REPORT_MAX_DATASET_ROWS = 12_000

export const PREMIUM_REPORT_SAMPLE_ROWS = 8

export const PREMIUM_REPORT_LEAN_SAMPLE_ROWS = 2

export const PREMIUM_REPORT_MIN_DAYS_WITH_DATA = 3

export const PREMIUM_REPORT_MIN_ATHLETES_WITH_DATA = 2

export const PREMIUM_REPORT_SQL_MAX_ROWS = 10_000

export const PREMIUM_REPORT_SQL_MAX_BYTES = 4_000_000

export const PREMIUM_REPORT_CHART_WIDTH = 1030

export const PREMIUM_REPORT_CHART_HEIGHT = 480

export const PREMIUM_CHART_PRESET = {
  DONUT: 'donut',
  BAR: 'bar',
  LINE: 'line',
  BAR_LINE: 'bar-line',
  HEATMAP: 'heatmap',
  RADAR: 'radar',
  SCATTER: 'scatter',
} as const

export type PremiumChartPreset = (typeof PREMIUM_CHART_PRESET)[keyof typeof PREMIUM_CHART_PRESET]

export const PREMIUM_CHART_PRESETS = Object.values(PREMIUM_CHART_PRESET) as PremiumChartPreset[]

export const isPremiumChartPreset = (value: string): value is PremiumChartPreset =>
  PREMIUM_CHART_PRESETS.includes(value as PremiumChartPreset)

export const PREMIUM_VALUE_TRANSFORM_OP = {
  ROUND: 'round',
  FLOOR: 'floor',
  CEIL: 'ceil',
  MULTIPLY: 'multiply',
  DIVIDE: 'divide',
  ADD: 'add',
  SUBTRACT: 'subtract',
} as const

export type PremiumValueTransformOp =
  (typeof PREMIUM_VALUE_TRANSFORM_OP)[keyof typeof PREMIUM_VALUE_TRANSFORM_OP]

export const PREMIUM_VALUE_TRANSFORM_OPS = Object.values(
  PREMIUM_VALUE_TRANSFORM_OP
) as PremiumValueTransformOp[]

export const isValueTransformOp = (value: string): value is PremiumValueTransformOp =>
  PREMIUM_VALUE_TRANSFORM_OPS.includes(value as PremiumValueTransformOp)

export const isPremiumBlockType = (value: string): value is PremiumBlockType =>
  PREMIUM_BLOCK_TYPES.includes(value as PremiumBlockType)

export const PREMIUM_REPORT_ANTHROPIC_VERSION = 'bedrock-2023-05-31'
export const PREMIUM_REPORT_TEMPERATURE = 0.3
export const PREMIUM_TOOL_HISTORY_CAP = 20
export const PREMIUM_TOOL_HISTORY_TRIM = 15

export const PREMIUM_CANVAS_ASK = {
  EXPLAIN: 'explain',
  MICRO_EDIT: 'micro_edit',
  RESHAPE: 'reshape',
  SPLIT: 'split',
  DUPLICATE: 'duplicate',
  REMOVE: 'remove',
  NEW_VIZ: 'new_viz',
  NONE: 'none',
} as const

export type PremiumCanvasAskKind = (typeof PREMIUM_CANVAS_ASK)[keyof typeof PREMIUM_CANVAS_ASK]

export const PREMIUM_CANVAS_ASK_KINDS = Object.values(PREMIUM_CANVAS_ASK) as PremiumCanvasAskKind[]

export type PremiumJevProvider = 'jev' | 'heuristic' | 'fallback' | 'skip'

export type PremiumCanvasAsk = {
  kind: PremiumCanvasAskKind
  provider: PremiumJevProvider
  score?: number
}

export type PremiumAliasCatalogEntry = {
  id: string
  aliases: readonly string[]
}

export const PREMIUM_VALD_TEST_TYPES = [
  {
    id: 'CMJ',
    aliases: ['cmj', 'counter movement', 'counter-movement', 'countermovement'],
  },
  {
    id: 'DJ',
    aliases: ['dj', 'drop jump', 'drop-jump'],
  },
  {
    id: 'SLJ',
    aliases: ['slj', 'single leg jump', 'single-leg jump'],
  },
] as const satisfies readonly PremiumAliasCatalogEntry[]

export const normalizeCatalogIds = (
  values: string[],
  catalog: readonly PremiumAliasCatalogEntry[]
): string[] => {
  const out: string[] = []
  for (const raw of values) {
    const key = raw.trim().toLowerCase()
    if (!key) continue
    const hit = catalog.find(
      (entry) =>
        entry.id.toLowerCase() === key || entry.aliases.some((alias) => alias.toLowerCase() === key)
    )
    if (hit && !out.includes(hit.id)) out.push(hit.id)
  }
  return out
}
