export const CHART_SVG_TYPE = {
  SPARKLINE: 'sparkline',
  LINES: 'lines',
  SORTED_BARS: 'sorted_bars',
  GAP_TO_REFERENCE: 'gap_to_reference',
  SMALL_MULTIPLES: 'small_multiples',
  SCATTER: 'scatter',
  ACWR: 'acwr',
  COLUMNS_LINE: 'columns_line',
  STACKED_COLUMNS: 'stacked_columns',
  TIMELINE: 'timeline',
  DISTRIBUTION: 'distribution',
  MATRIX: 'matrix',
  RADAR: 'radar',
  LINES_BAND: 'lines_band',
} as const

export type ChartSvgType = (typeof CHART_SVG_TYPE)[keyof typeof CHART_SVG_TYPE]

export type ChartSvgResult = {
  svg: string
  error?: string
}

export type ChartSvgRequest = {
  type: ChartSvgType | string
  datasetId: string
  dataset?: Record<string, unknown>
  options?: Record<string, unknown>
}

export type LineSeries = {
  kind: 'risk' | 'perf'
  name: string
  values: number[]
  labelAt?: number[]
  below?: number[]
}

export type BarItem = {
  label: string
  value: number
  display?: string
  focus?: boolean
}

export type DeviationItem = {
  label: string
  value: number
}

export type SmallMultiplePanel = {
  title: string
  values: number[]
}

export type ScatterPoint = {
  label: string
  x: number
  y: number
  focus?: boolean
  side?: 'r' | 'l' | 't' | 'b'
}

export type AcwrSeries = {
  name: string
  values: number[]
  color?: string
  ref?: boolean
}

export type TimelineRow = {
  who: string
  what: string
  start: number
  end: number
  ongoing: boolean
  phase: string
}

export type DotStripRow = {
  title: string
  values: Record<string, number>
  focus: string[]
}

export type MatrixRow = {
  label: string
  risk: number[]
  perf: number[]
  riskMean: number
  perfMean: number
  focus?: boolean
}

export type MatrixInput = {
  rows: MatrixRow[]
  dayLetters: string[]
  dayNumbers: number[]
  avgLabel?: string
  teamLabel?: string
}

export type RadarAxis = {
  key: string
  label: string
  max?: number
}

export type RadarSeries = {
  name: string
  values: number[]
  focus?: boolean
}

export type LinesBandInput = {
  xLabels: string[]
  mean: number[]
  min: number[]
  max: number[]
  w?: number
  h?: number
  yMin?: number
  yMax?: number
  meanName?: string
}
