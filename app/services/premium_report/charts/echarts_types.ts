type EchartsEncode = {
  x?: string | string[]
  y?: string | string[]
  tooltip?: string | string[]
  itemName?: string
  value?: string
}

type EchartsTextStyle = {
  fontSize?: number
  color?: string
  fontWeight?: string | number
  [key: string]: unknown
}

type EchartsLineStyle = {
  width?: number
  color?: string
  type?: string
  opacity?: number
  [key: string]: unknown
}

type EchartsItemStyle = {
  color?: string
  shadowBlur?: number
  shadowColor?: string
  [key: string]: unknown
}

export type EchartsGrid = {
  left?: number | string
  right?: number | string
  top?: number | string
  bottom?: number | string
  containLabel?: boolean
  height?: string | number
  [key: string]: unknown
}

export type EchartsLegend = {
  show?: boolean
  type?: string
  top?: number | string
  left?: number | string
  width?: string | number
  data?: unknown[]
  textStyle?: EchartsTextStyle
  itemWidth?: number
  itemHeight?: number
  itemGap?: number
  icon?: string
  pageButtonItemGap?: number
  pageIconSize?: number
  pageTextStyle?: EchartsTextStyle
  [key: string]: unknown
}

export type EchartsTooltip = {
  trigger?: 'axis' | 'item' | string
  show?: boolean
  position?: string
  renderMode?: string
  appendTo?: string
  extraCssText?: string
  [key: string]: unknown
}

export type EchartsAxis = {
  type?: 'value' | 'category' | 'time' | string
  name?: string
  nameLocation?: string
  nameGap?: number
  nameTextStyle?: EchartsTextStyle
  data?: unknown[]
  scale?: boolean
  min?: unknown
  max?: unknown
  minInterval?: number
  position?: string
  inverse?: boolean
  axisLabel?: EchartsTextStyle & { rotate?: number; interval?: number | string; hideOverlap?: boolean }
  axisTick?: { show?: boolean; [key: string]: unknown }
  axisLine?: { show?: boolean; lineStyle?: EchartsLineStyle; [key: string]: unknown }
  splitLine?: { lineStyle?: EchartsLineStyle; [key: string]: unknown }
  splitArea?: { show?: boolean; [key: string]: unknown }
  [key: string]: unknown
}

export type EchartsMarkLineItem = {
  xAxis?: unknown
  yAxis?: unknown
  name?: string
  label?: EchartsTextStyle & { formatter?: string; position?: string; distance?: number }
  lineStyle?: EchartsLineStyle
  [key: string]: unknown
}

export type EchartsSeriesItem = {
  type?: string
  name?: string
  data?: unknown
  encode?: EchartsEncode
  stack?: string
  yAxisIndex?: number
  z?: number
  smooth?: number | boolean
  showSymbol?: boolean
  symbol?: string
  symbolSize?: number
  connectNulls?: boolean
  barMaxWidth?: number
  lineStyle?: EchartsLineStyle
  itemStyle?: EchartsItemStyle
  areaStyle?: { color?: string; [key: string]: unknown }
  emphasis?: { disabled?: boolean; focus?: string; lineStyle?: EchartsLineStyle; itemStyle?: EchartsItemStyle; [key: string]: unknown }
  markLine?: { silent?: boolean; symbol?: string; animation?: boolean; data?: EchartsMarkLineItem[]; [key: string]: unknown }
  label?: EchartsTextStyle & { show?: boolean }
  tooltip?: EchartsTooltip | boolean
  legendHoverLink?: boolean
  radius?: string | string[]
  [key: string]: unknown
}

type BarOrientation = 'horizontal' | 'vertical' | 'auto'

export type EchartsOption = {
  animation?: boolean
  legend?: EchartsLegend
  grid?: EchartsGrid
  tooltip?: EchartsTooltip
  xAxis?: EchartsAxis | EchartsAxis[]
  yAxis?: EchartsAxis | EchartsAxis[]
  series?: EchartsSeriesItem | EchartsSeriesItem[]
  dataset?: { source?: unknown; [key: string]: unknown }
  radar?: Record<string, unknown>
  visualMap?: Record<string, unknown>
  orientation?: BarOrientation
  maunaBarOrientation?: Exclude<BarOrientation, 'auto'>
  [key: string]: unknown
}

export const isPlainRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value && typeof value === 'object' && !Array.isArray(value))

export const asEchartsOption = (value: Record<string, unknown>): EchartsOption =>
  value as EchartsOption

export const asSeriesList = (series: unknown): EchartsSeriesItem[] => {
  if (!Array.isArray(series)) {
    return isPlainRecord(series) ? [series as EchartsSeriesItem] : []
  }
  return series.filter((entry): entry is EchartsSeriesItem => isPlainRecord(entry))
}
