import { PREMIUM_CHART_PRESET, type PremiumChartPreset } from '#constants/premium_report.constants'

export const PREMIUM_GRAIN = {
  TEAM: 'team',
  INDIVIDUAL: 'individual',
  BOTH: 'both',
} as const

export type PremiumGrain = (typeof PREMIUM_GRAIN)[keyof typeof PREMIUM_GRAIN]

export const PREMIUM_GRAINS = Object.values(PREMIUM_GRAIN) as PremiumGrain[]

export const PREMIUM_VIZ_LAYOUT = {
  SINGLE: 'single',
  SPLIT_METRICS: 'split_metrics',
  SPLIT_ATHLETES: 'split_athletes',
} as const

export type PremiumVizLayout = (typeof PREMIUM_VIZ_LAYOUT)[keyof typeof PREMIUM_VIZ_LAYOUT]

export const PREMIUM_VIZ_LAYOUTS = Object.values(PREMIUM_VIZ_LAYOUT) as PremiumVizLayout[]

export const PREMIUM_CHART_HINT = {
  AUTO: 'auto',
  TABLE: 'table',
  LINE: PREMIUM_CHART_PRESET.LINE,
  BAR: PREMIUM_CHART_PRESET.BAR,
  SCATTER: PREMIUM_CHART_PRESET.SCATTER,
  RADAR: PREMIUM_CHART_PRESET.RADAR,
  BAR_LINE: PREMIUM_CHART_PRESET.BAR_LINE,
  DONUT: PREMIUM_CHART_PRESET.DONUT,
  HEATMAP: PREMIUM_CHART_PRESET.HEATMAP,
} as const

export type PremiumChartHint = (typeof PREMIUM_CHART_HINT)[keyof typeof PREMIUM_CHART_HINT]

export const PREMIUM_CHART_HINTS = Object.values(PREMIUM_CHART_HINT) as PremiumChartHint[]

export const PREMIUM_DERIVE_MODE = {
  RAW: 'raw',
  DERIVED: 'derived',
  BOTH: 'both',
} as const

export type PremiumDeriveMode = (typeof PREMIUM_DERIVE_MODE)[keyof typeof PREMIUM_DERIVE_MODE]

export const PREMIUM_DERIVE_MODES = Object.values(PREMIUM_DERIVE_MODE) as PremiumDeriveMode[]

export type PremiumReportIntent = {
  grain: PremiumGrain
  vizLayout: PremiumVizLayout
  chartHint: PremiumChartHint
  deriveMode: PremiumDeriveMode
  tableHeat: boolean
  analysisText: boolean
  timeSeries: boolean
  distanceKm: boolean
  insertAtTop: boolean
}

export const defaultPremiumIntent = (): PremiumReportIntent => ({
  grain: PREMIUM_GRAIN.INDIVIDUAL,
  vizLayout: PREMIUM_VIZ_LAYOUT.SINGLE,
  chartHint: PREMIUM_CHART_HINT.AUTO,
  deriveMode: PREMIUM_DERIVE_MODE.BOTH,
  tableHeat: true,
  analysisText: true,
  timeSeries: false,
  distanceKm: false,
  insertAtTop: false,
})

export const PREMIUM_INTENT_CHOICE_CATALOG = {
  grain: {
    question:
      'For `prompt`, how should athletes be shown? Team = squad mean/aggregate (optionally with min/max band). Individual = per-player series or rows. Both = team overview plus individual focus.',
    criteria: {
      [PREMIUM_GRAIN.TEAM]: 'Team / squad aggregate (mean, min/max band, or group summary)',
      [PREMIUM_GRAIN.INDIVIDUAL]: 'Individual athletes as separate series or rows',
      [PREMIUM_GRAIN.BOTH]: 'Both team aggregate and individual athletes',
    },
  },
  vizLayout: {
    question:
      'Should the deliverable be one combined viz, or several vizs that partition metrics or athletes? Prefer split_athletes when the coach asks for individual evolutions of many / whole-squad players (line charts auto-chunk ≤6 athletes). Prefer SINGLE for team-mean (+ min–max) or a small named watchlist. Prefer split_metrics when comparing metric families.',
    criteria: {
      [PREMIUM_VIZ_LAYOUT.SINGLE]:
        'Team mean chart, or ≤6 named athletes on one line — not a whole-squad spaghetti',
      [PREMIUM_VIZ_LAYOUT.SPLIT_METRICS]:
        'Split into several charts/tables by metric groups (e.g. distance vs accel)',
      [PREMIUM_VIZ_LAYOUT.SPLIT_ATHLETES]:
        'Whole squad individual evolutions → several Group 1..N charts of ≤6 athletes, plus optional team-mean chart',
    },
  },
  chartHint: {
    question:
      'Which primary visualization best fits `prompt`? Prefer auto when unclear. Prefer table for roster dumps / many columns. Prefer line for evolution / graphs over days / player load trajectories. Prefer bar for rankings. Prefer scatter for links between two metrics.',
    criteria: {
      [PREMIUM_CHART_HINT.AUTO]: 'Unclear — pick at render time from the dataset shape',
      [PREMIUM_CHART_HINT.TABLE]: 'Table / heatmap grid of values',
      [PREMIUM_CHART_HINT.LINE]: 'Line chart — time series / evolution',
      [PREMIUM_CHART_HINT.BAR]: 'Bar chart — ranking or group comparison',
      [PREMIUM_CHART_HINT.BAR_LINE]: 'Bars + line overlay — two complementary metrics',
      [PREMIUM_CHART_HINT.SCATTER]: 'Scatter — relationship between two metrics',
      [PREMIUM_CHART_HINT.RADAR]:
        'Radar — multi-axis profile (≥4 metrics, ≤3 series; never Top-N)',
      [PREMIUM_CHART_HINT.DONUT]: 'Donut — share / composition',
      [PREMIUM_CHART_HINT.HEATMAP]: 'Heatmap — correlation matrix cells',
    },
  },
  deriveMode: {
    question:
      'For `prompt`, should the report lean on raw period totals only, or also compute derived metrics (rolling trends, acute:chronic load, monotony/strain, z-scores, % change vs baseline/group) to support staff interpretation and comparisons? Prefer both for rankings with context, form/fatigue language, or "vs average / vs usual". Prefer derived when the ask is mainly trends/form/risk. Prefer raw for simple dumps, unit edits, or single-day snapshots.',
    criteria: {
      [PREMIUM_DERIVE_MODE.RAW]:
        'Raw values / period totals only — no rolling or relative formulas needed',
      [PREMIUM_DERIVE_MODE.DERIVED]:
        'Emphasize derived metrics for interpretation (EWMA/MA, ACWR, monotony/strain, zscore, delta_pct, pct_baseline)',
      [PREMIUM_DERIVE_MODE.BOTH]:
        'Show raw alongside derived so staff can compare absolute load to trends / relative status',
    },
  },
} as const

export const PREMIUM_INTENT_FLAG_CATALOG = {
  tableHeat: {
    question:
      'Would relative cell coloring on tables help staff spot extremes for this `prompt`? False for plain dumps, tiny tables, or when the coach only wants charts.',
    trueLabel: 'Use table heat colors',
    falseLabel: 'Plain tables / no heat',
  },
  analysisText: {
    question:
      'Should the canvas include short analysis captions (add_text) under key vizs for this `prompt`? False when the coach only wants charts/tables or is editing style.',
    trueLabel: 'Add analysis captions',
    falseLabel: 'No analysis text blocks',
  },
  timeSeries: {
    question:
      'Does `prompt` ask for evolution, trend, daily series, load over days, or several graphs of players over time (needs line charts on date_of_day)?',
    trueLabel: 'Time-series / evolution',
    falseLabel: 'Snapshot or non-temporal',
  },
  distanceKm: {
    question:
      'Does `prompt` ask to express distance in kilometers (km) rather than meters?',
    trueLabel: 'Wants km',
    falseLabel: 'No km unit change',
  },
  insertAtTop: {
    question:
      'Does `prompt` ask to place new content at the top of the report/document/PDF?',
    trueLabel: 'Insert at top',
    falseLabel: 'Append / default placement',
  },
} as const

export const isPremiumGrain = (value: string): value is PremiumGrain =>
  (PREMIUM_GRAINS as readonly string[]).includes(value)

export const isPremiumVizLayout = (value: string): value is PremiumVizLayout =>
  (PREMIUM_VIZ_LAYOUTS as readonly string[]).includes(value)

export const isPremiumChartHint = (value: string): value is PremiumChartHint =>
  (PREMIUM_CHART_HINTS as readonly string[]).includes(value)

export const isPremiumDeriveMode = (value: string): value is PremiumDeriveMode =>
  (PREMIUM_DERIVE_MODES as readonly string[]).includes(value)

export const chartHintAsPreset = (hint: PremiumChartHint): PremiumChartPreset | undefined => {
  if (hint === PREMIUM_CHART_HINT.AUTO || hint === PREMIUM_CHART_HINT.TABLE) return undefined
  return hint
}

