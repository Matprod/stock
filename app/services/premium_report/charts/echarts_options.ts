import {
  PREMIUM_CHART_PRESET,
  PREMIUM_RADAR_MAX_SERIES,
  PREMIUM_RADAR_MIN_METRICS,
  type PremiumChartPreset,
} from '#constants/premium_report.constants'
import type { PremiumDataset } from '#contracts/premium_report'
import { displayColumnLabel } from '#services/premium_report/column_labels'
import {
  aggregateRowsByCategory,
  recordsFromDatasetSource,
  splitSeriesByScale,
} from '#services/premium_report/charts/dataset_transforms'
import {
  type ChartRefLines,
  isEnvelopeStatSeriesName,
  isIndividualEvolutionTitle,
  isMeanMinMaxEnvelopeColumns,
  isSquadRangeSeriesName,
  isTeamAggregateSeriesName,
  isTeamMeanEvolutionTitle,
  looksLikeDateLabel,
  pickSeriesGroupColumn,
  pickValueColumns,
  preferLineMetric,
  resolveSingleGrainLineMetrics,
  wantsSquadEnvelopeTitle,
} from '#services/premium_report/charts/chart_rules'
import {
  asSeriesList,
  type EchartsAxis,
  type EchartsMarkLineItem,
  type EchartsOption,
  type EchartsSeriesItem,
  isPlainRecord,
} from '#services/premium_report/charts/echarts_types'
import {
  columnStats,
  formatDisplayNumber,
  formatIsoDateLabel,
  normalizeIsoDate,
  pickDateColumn,
  toNumber,
  uniqueSortedIsoDates,
} from '#services/premium_report/dataset_ops'
import type { AppLanguage } from '#utils/localize'

const axisTooltip = {
  trigger: 'axis' as const,
  renderMode: 'html' as const,
  appendTo: 'body',
  extraCssText: 'z-index: 9999; max-height: 70vh; overflow-y: auto;',
}

const RADAR_SERIES_COLORS = [
  '#2563eb',
  '#dc2626',
  '#059669',
  '#d97706',
  '#7c3aed',
  '#0891b2',
] as const

const namedValueAxis = (valueColumn: string): EchartsAxis => ({
  type: 'value',
  name: valueColumn,
  nameLocation: 'middle',
  nameGap: 44,
  nameTextStyle: { fontSize: 10, color: '#64748b' },
  scale: true,
  axisLabel: { color: '#64748b', fontSize: 10 },
  axisTick: { show: false },
  axisLine: { show: false },
  splitLine: { lineStyle: { color: '#f1f5f9', width: 1 } },
})

const REF_LINE_LABELS: Record<
  AppLanguage,
  { mean: string; median: string; min: string; max: string }
> = {
  fr: { mean: 'Moyenne', median: 'Médiane', min: 'Min', max: 'Max' },
  en: { mean: 'Mean', median: 'Median', min: 'Min', max: 'Max' },
}

const REF_LINE_SPECS: Record<
  Exclude<ChartRefLines, 'none'>,
  Array<{
    key: 'mean' | 'median' | 'min' | 'max'
    dash: 'solid' | 'dashed' | 'dotted'
    position: string
  }>
> = {
  mean: [{ key: 'mean', dash: 'dashed', position: 'insideEndTop' }],
  mean_median: [
    { key: 'mean', dash: 'dashed', position: 'insideEndTop' },
    { key: 'median', dash: 'dotted', position: 'insideStartTop' },
  ],
  full: [
    { key: 'mean', dash: 'dashed', position: 'insideEndTop' },
    { key: 'median', dash: 'dotted', position: 'insideStartTop' },
    { key: 'min', dash: 'solid', position: 'insideStartTop' },
    { key: 'max', dash: 'solid', position: 'insideStartBottom' },
  ],
}

const buildRefLines = (
  rows: Array<Record<string, unknown>>,
  column: string,
  axis: 'xAxis' | 'yAxis',
  mode: ChartRefLines,
  language: AppLanguage = 'fr'
): EchartsMarkLineItem[] => {
  if (mode === 'none') return []
  const stats = columnStats(rows, column)
  if (!stats || stats.n < 3) return []
  const labels = REF_LINE_LABELS[language] ?? REF_LINE_LABELS.fr
  return REF_LINE_SPECS[mode].map((spec) => ({
    [axis]: stats[spec.key],
    name: labels[spec.key],
    label: {
      formatter: `${labels[spec.key]} ${formatDisplayNumber(stats[spec.key], language)}`,
      position: spec.position,
      fontSize: 10,
      color: '#94a3b8',
      distance: 6,
    },
    lineStyle: { type: spec.dash, width: 1.25, color: '#64748b' },
  }))
}

const attachRefLines = (
  seriesItem: EchartsSeriesItem,
  lines: EchartsMarkLineItem[]
): EchartsSeriesItem => {
  if (!lines.length) return seriesItem
  const prev =
    seriesItem.markLine &&
    typeof seriesItem.markLine === 'object' &&
    !Array.isArray(seriesItem.markLine)
      ? seriesItem.markLine
      : {}
  const prevData = Array.isArray(prev.data) ? prev.data : []
  return {
    ...seriesItem,
    markLine: {
      silent: true,
      symbol: 'none',
      animation: false,
      ...prev,
      data: [...prevData, ...lines],
    },
  }
}

export const buildAbsoluteMarkLines = (
  values: number[],
  axis: 'xAxis' | 'yAxis' = 'yAxis'
): EchartsMarkLineItem[] =>
  values
    .filter((n) => Number.isFinite(n))
    .map((value) => ({
      [axis]: value,
      name: String(value),
      label: {
        formatter: String(value),
        position: 'insideEndTop' as const,
        fontSize: 10,
        color: '#94a3b8',
        distance: 6,
      },
      lineStyle: { type: 'dashed' as const, width: 1.25, color: '#64748b' },
    }))

export const attachAbsoluteMarkLines = (
  option: EchartsOption,
  values: number[],
  axis: 'xAxis' | 'yAxis' = 'yAxis'
): EchartsOption => {
  const lines = buildAbsoluteMarkLines(values, axis)
  if (!lines.length) return option
  const seriesRaw = Array.isArray(option.series) ? option.series : []
  if (!seriesRaw.length) return option
  return {
    ...option,
    series: seriesRaw.map((entry, index) => {
      if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return entry
      return index === 0 ? attachRefLines(entry as EchartsSeriesItem, lines) : entry
    }) as EchartsSeriesItem[],
  }
}

export const buildEchartsHeatmapOption = (args: {
  rows: Array<Record<string, unknown>>
  xCol: string
  yCol: string
  valueCol: string
  language?: AppLanguage
}): EchartsOption => {
  const { rows, xCol, yCol, valueCol } = args
  const language = args.language ?? 'fr'
  const metrics: string[] = []
  const seen = new Set<string>()
  for (const row of rows) {
    for (const key of [row[xCol], row[yCol]]) {
      const label = String(key ?? '').trim()
      if (!label || seen.has(label)) continue
      seen.add(label)
      metrics.push(label)
    }
  }
  const indexOf = new Map(metrics.map((label, index) => [label, index]))
  const data: Array<[number, number, number]> = []
  for (const row of rows) {
    const xi = indexOf.get(String(row[xCol] ?? '').trim())
    const yi = indexOf.get(String(row[yCol] ?? '').trim())
    if (xi == null || yi == null) continue
    const raw = row[valueCol]
    const value =
      typeof raw === 'number'
        ? raw
        : typeof raw === 'string' && raw.trim() !== ''
          ? Number(raw)
          : NaN
    if (!Number.isFinite(value)) continue
    data.push([xi, yi, Math.round(value * 1000) / 1000])
  }
  const labels = metrics.map((value) => displayColumnLabel(value, language))
  return {
    tooltip: { position: 'top' },
    grid: { left: '18%', right: '6%', top: '6%', bottom: '22%', height: '62%' },
    xAxis: {
      type: 'category',
      data: labels,
      splitArea: { show: true },
      axisLabel: { rotate: 40, interval: 0, hideOverlap: false },
    },
    yAxis: {
      type: 'category',
      data: labels,
      splitArea: { show: true },
      inverse: true,
      axisLabel: { interval: 0 },
    },
    visualMap: {
      min: -1,
      max: 1,
      calculable: true,
      orient: 'horizontal',
      left: 'center',
      bottom: '2%',
      itemWidth: 16,
      itemHeight: 120,
      inRange: {
        color: [
          '#313695',
          '#4575b4',
          '#74add1',
          '#abd9e9',
          '#e0f3f8',
          '#ffffbf',
          '#fee090',
          '#fdae61',
          '#f46d43',
          '#d73027',
          '#a50026',
        ],
      },
      text: ['+1', '−1'],
    },
    series: [
      {
        type: 'heatmap',
        data,
        label: { show: true },
        emphasis: {
          itemStyle: { shadowBlur: 10, shadowColor: 'rgba(0, 0, 0, 0.45)' },
        },
      },
    ],
  }
}

const seriesLineData = (entry: EchartsSeriesItem): Array<number | null> | null => {
  if (!Array.isArray(entry.data)) return null
  return entry.data.map((point) => {
    if (typeof point === 'number' && Number.isFinite(point)) return point
    if (point && typeof point === 'object' && !Array.isArray(point)) {
      const value = (point as { value?: unknown }).value
      if (typeof value === 'number' && Number.isFinite(value)) return value
    }
    return null
  })
}

type MemberSeriesView = { name: string; data: Array<number | null> }

const isEnvelopeStatLine = (name: string): boolean =>
  isEnvelopeStatSeriesName(name, 'min') ||
  isEnvelopeStatSeriesName(name, 'max') ||
  isEnvelopeStatSeriesName(name, 'mean') ||
  isTeamAggregateSeriesName(name)

const isAthleteLineSeries = (entry: EchartsSeriesItem): boolean => {
  const name = String(entry.name ?? '')
  return Boolean(name) && !isEnvelopeStatLine(name)
}

const memberSeriesFromInline = (
  lineSeries: EchartsSeriesItem[],
  pointCount: number
): { members: MemberSeriesView[]; hasTeam: boolean } => {
  const members: MemberSeriesView[] = []
  let hasTeam = false
  for (const entry of lineSeries) {
    const name = String(entry.name ?? '')
    if (!name || isSquadRangeSeriesName(name) || entry.stack === 'squad-range') continue
    if (isEnvelopeStatLine(name)) {
      hasTeam = true
      continue
    }
    const data = seriesLineData(entry)
    if (!data || data.length !== pointCount) continue
    members.push({ name, data })
  }
  return { members, hasTeam }
}

const memberSeriesFromDataset = (
  option: EchartsOption,
  lineSeries: EchartsSeriesItem[]
): { members: MemberSeriesView[]; hasTeam: boolean; xData: unknown[] } | null => {
  const dataset = option.dataset
  if (!dataset || typeof dataset !== 'object' || Array.isArray(dataset)) return null
  const source = dataset.source
  if (!Array.isArray(source) || source.length < 5) return null
  const header = source[0]
  if (!Array.isArray(header)) return null
  const cols = header.map((c) => String(c ?? ''))
  const dateIdx = cols.findIndex((c) => /date|jour|day/i.test(c))
  if (dateIdx < 0) return null

  const encodeYs = new Set<string>()
  for (const entry of lineSeries) {
    const encode = entry.encode
    if (encode && typeof encode === 'object' && !Array.isArray(encode)) {
      const y = encode.y
      if (typeof y === 'string') encodeYs.add(y)
    }
    if (typeof entry.name === 'string') encodeYs.add(entry.name)
  }

  const xData = source.slice(1).map((row) => (Array.isArray(row) ? row[dateIdx] : null))
  const members: MemberSeriesView[] = []
  let hasTeam = false
  for (let colIdx = 0; colIdx < cols.length; colIdx += 1) {
    if (colIdx === dateIdx) continue
    const name = cols[colIdx]!
    if (!encodeYs.has(name) && encodeYs.size > 0) continue
    if (isSquadRangeSeriesName(name)) continue
    if (isEnvelopeStatLine(name)) {
      hasTeam = true
      continue
    }
    const data = source.slice(1).map((row) => {
      if (!Array.isArray(row)) return null
      return toNumber(row[colIdx])
    })
    const numericCount = data.filter((n) => n != null).length
    if (numericCount < 3) continue
    members.push({ name, data })
  }
  if (members.length < 2) return null
  return { members, hasTeam, xData }
}

export const stripSquadRangeBandSeries = (option: EchartsOption): EchartsOption => {
  const seriesRaw = Array.isArray(option.series) ? option.series : null
  if (!seriesRaw?.length) return option
  const series = seriesRaw.filter((entry) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return true
    const row = entry as EchartsSeriesItem
    if (row.stack === 'squad-range') return false
    return !isSquadRangeSeriesName(String(row.name ?? ''))
  })
  if (series.length === seriesRaw.length) return option
  const prevLegend =
    option.legend && typeof option.legend === 'object' && !Array.isArray(option.legend)
      ? { ...option.legend }
      : null
  if (prevLegend && Array.isArray(prevLegend.data)) {
    prevLegend.data = prevLegend.data.filter(
      (name) => typeof name === 'string' && !isSquadRangeSeriesName(name)
    )
  }
  return { ...option, series, ...(prevLegend ? { legend: prevLegend } : {}) }
}

const visibleLineSeries = (series: EchartsSeriesItem[]): EchartsSeriesItem[] =>
  series.filter((entry) => {
    const name = String(entry.name ?? '')
    if (!name || name.startsWith('_')) return false
    if (isSquadRangeSeriesName(name) || entry.stack === 'squad-range') return false
    return String(entry.type ?? 'line') === 'line'
  })

/** Min–max only on team-mean charts — never on individual player spaghetti. */
const isMeanOnlyLineChart = (
  lineSeries: EchartsSeriesItem[],
  chartTitle: string,
  layoutHint?: string
): boolean => {
  if (layoutHint === 'individual') return false
  if (layoutHint === 'team_mean' || layoutHint === 'squad_envelope') {
    const visible = visibleLineSeries(lineSeries)
    if (visible.length === 0) return false
    return visible.every((entry) => !isAthleteLineSeries(entry))
  }
  if (isIndividualEvolutionTitle(chartTitle)) return false
  const visible = visibleLineSeries(lineSeries)
  if (visible.length === 0) return false
  if (visible.some(isAthleteLineSeries)) return false
  const hasTeam = visible.some((entry) => isEnvelopeStatLine(String(entry.name ?? '')))
  return (
    hasTeam ||
    isTeamMeanEvolutionTitle(chartTitle) ||
    wantsSquadEnvelopeTitle(chartTitle)
  )
}

const seriesYColumn = (entry: EchartsSeriesItem): string | null => {
  const encode = entry.encode
  if (encode && typeof encode === 'object' && !Array.isArray(encode) && typeof encode.y === 'string') {
    return encode.y
  }
  return typeof entry.name === 'string' ? entry.name : null
}

const seriesLineDataFromDataset = (
  option: EchartsOption,
  entry: EchartsSeriesItem
): { xData: unknown[]; data: Array<number | null> } | null => {
  const dataset = option.dataset
  if (!dataset || typeof dataset !== 'object' || Array.isArray(dataset)) return null
  const source = dataset.source
  if (!Array.isArray(source) || source.length < 2) return null
  const header = source[0]
  if (!Array.isArray(header)) return null
  const cols = header.map((c) => String(c ?? ''))
  const yCol = seriesYColumn(entry)
  if (!yCol) return null
  const yIdx = cols.findIndex((c) => c === yCol)
  if (yIdx < 0) return null
  const dateIdx = cols.findIndex((c) => /date|jour|day/i.test(c))
  if (dateIdx < 0) return null
  const xData = source.slice(1).map((row) => (Array.isArray(row) ? row[dateIdx] : null))
  const data = source.slice(1).map((row) => {
    if (!Array.isArray(row)) return null
    return toNumber(row[yIdx])
  })
  return { xData, data }
}

const resolveSeriesLineData = (
  option: EchartsOption,
  entry: EchartsSeriesItem
): { xData?: unknown[]; data: Array<number | null> } | null => {
  const inline = seriesLineData(entry)
  if (inline) return { data: inline }
  return seriesLineDataFromDataset(option, entry)
}

const appendSquadRangeBandToOption = (args: {
  typed: EchartsOption
  seriesRaw: unknown[]
  xData: unknown[]
  mins: Array<number | null>
  maxes: Array<number | null>
  spreads: Array<number | null>
  language: AppLanguage
}): EchartsOption => {
  const { typed, xData, mins, maxes, spreads, language } = args
  const rangeLabel = language === 'fr' ? 'Équipe (min–max)' : 'Squad (min–max)'
  const minLabel = language === 'fr' ? 'Min équipe' : 'Squad min'
  const maxLabel = language === 'fr' ? 'Max équipe' : 'Squad max'
  const bandBase: EchartsSeriesItem = {
    name: rangeLabel,
    type: 'line',
    data: mins,
    symbol: 'none',
    showSymbol: false,
    connectNulls: false,
    stack: 'squad-range',
    lineStyle: { width: 0, opacity: 0 },
    itemStyle: { color: 'rgba(79,110,247,0.35)' },
    z: 1,
    emphasis: { disabled: true },
  }
  const bandPad: EchartsSeriesItem = {
    name: rangeLabel,
    type: 'line',
    data: spreads,
    symbol: 'none',
    showSymbol: false,
    connectNulls: false,
    stack: 'squad-range',
    lineStyle: { width: 0, opacity: 0 },
    areaStyle: { color: 'rgba(79,110,247,0.14)' },
    tooltip: { show: false },
    legendHoverLink: false,
    z: 1,
    emphasis: { disabled: true },
  }
  const minLine: EchartsSeriesItem = {
    name: minLabel,
    type: 'line',
    data: mins,
    symbol: 'none',
    showSymbol: false,
    connectNulls: true,
    lineStyle: { type: 'dashed', width: 1.15, color: '#94a3b8' },
    itemStyle: { color: '#94a3b8' },
    z: 2,
  }
  const maxLine: EchartsSeriesItem = {
    name: maxLabel,
    type: 'line',
    data: maxes,
    symbol: 'none',
    showSymbol: false,
    connectNulls: true,
    lineStyle: { type: 'dashed', width: 1.15, color: '#64748b' },
    itemStyle: { color: '#64748b' },
    z: 2,
  }

  const nextSeries: EchartsSeriesItem[] = args.seriesRaw.flatMap((entry) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return []
    const row = entry as EchartsSeriesItem
    const name = String(row.name ?? '')
    if (isSquadRangeSeriesName(name) || row.stack === 'squad-range') return []
    if (isEnvelopeStatSeriesName(name, 'min') || isEnvelopeStatSeriesName(name, 'max')) return []
    if (!isTeamAggregateSeriesName(name) && !isEnvelopeStatSeriesName(name, 'mean')) {
      return [row]
    }
    const lineStyle = row.lineStyle && typeof row.lineStyle === 'object' ? row.lineStyle : {}
    return [
      {
        ...row,
        z: 5,
        lineStyle: { width: 3.1, ...lineStyle },
        showSymbol: false,
      },
    ]
  })

  const seriesNames = [
    rangeLabel,
    minLabel,
    maxLabel,
    ...nextSeries
      .map((entry) =>
        entry && typeof entry === 'object' && !Array.isArray(entry)
          ? String((entry as EchartsSeriesItem).name ?? '')
          : ''
      )
      .filter((name) => Boolean(name) && !name.startsWith('_')),
  ]
  const uniqueLegend = [...new Set(seriesNames)]

  const prevLegend =
    typed.legend && typeof typed.legend === 'object' && !Array.isArray(typed.legend)
      ? typed.legend
      : {}
  const prevGrid =
    typed.grid && typeof typed.grid === 'object' && !Array.isArray(typed.grid)
      ? typed.grid
      : {}
  const xAxis =
    typed.xAxis && typeof typed.xAxis === 'object' && !Array.isArray(typed.xAxis)
      ? typed.xAxis
      : null

  const nextOption: EchartsOption = {
    ...typed,
    legend: {
      ...prevLegend,
      type: 'plain',
      top: 4,
      left: 'center',
      width: '92%',
      itemWidth: 10,
      itemHeight: 8,
      itemGap: 8,
      textStyle: {
        fontSize: 10,
        ...(isPlainRecord(prevLegend.textStyle) ? prevLegend.textStyle : {}),
      },
      data: uniqueLegend,
    },
    grid: {
      left: 56,
      right: 48,
      top: 56,
      bottom: 72,
      containLabel: true,
      ...prevGrid,
    },
    series: [bandBase, bandPad, minLine, maxLine, ...nextSeries],
  }
  if ((!xAxis || !Array.isArray(xAxis.data)) && xData.length) {
    nextOption.xAxis = {
      ...(xAxis ?? {}),
      type: 'category',
      data: xData,
    }
  }
  return nextOption
}

export const maybeAppendSquadRangeBand = (
  option: EchartsOption,
  language: AppLanguage = 'fr',
  chartTitle = ''
): EchartsOption => {
  const typed = option
  const seriesRaw = Array.isArray(typed.series) ? [...typed.series] : null
  if (!seriesRaw || seriesRaw.length < 1) return option

  const lineSeries = asSeriesList(seriesRaw).filter(
    (entry) => String(entry.type ?? 'line') === 'line'
  )
  const layoutHint =
    typeof (typed as { maunaLayout?: unknown }).maunaLayout === 'string'
      ? String((typed as { maunaLayout?: string }).maunaLayout)
      : undefined
  const wantsEnvelope =
    wantsSquadEnvelopeTitle(chartTitle) ||
    layoutHint === 'squad_envelope' ||
    layoutHint === 'team_mean'

  if (!isMeanOnlyLineChart(lineSeries, chartTitle, layoutHint) && !wantsEnvelope) {
    return stripSquadRangeBandSeries(option)
  }

  if (lineSeries.some((entry) => isSquadRangeSeriesName(String(entry.name ?? '')))) {
    return option
  }

  const xAxis =
    typed.xAxis && typeof typed.xAxis === 'object' && !Array.isArray(typed.xAxis)
      ? typed.xAxis
      : null
  let xData = Array.isArray(xAxis?.data) ? xAxis.data : null

  const minFromSeries = lineSeries.find((entry) =>
    isEnvelopeStatSeriesName(String(entry.name ?? ''), 'min')
  )
  const maxFromSeries = lineSeries.find((entry) =>
    isEnvelopeStatSeriesName(String(entry.name ?? ''), 'max')
  )
  if (minFromSeries && maxFromSeries) {
    const minResolved = resolveSeriesLineData(typed, minFromSeries)
    const maxResolved = resolveSeriesLineData(typed, maxFromSeries)
    if (minResolved && maxResolved) {
      if ((!xData || xData.length < 1) && minResolved.xData) xData = minResolved.xData
      const mins = minResolved.data
      const maxes = maxResolved.data
      if (xData && xData.length >= 1 && mins.length === xData.length && maxes.length === xData.length) {
        const spreads = mins.map((lo, i) => {
          const hi = maxes[i]
          if (typeof lo !== 'number' || typeof hi !== 'number') return null
          return Math.round((hi - lo) * 1000) / 1000
        })
        const covered = spreads.filter((n) => typeof n === 'number' && n > 0).length
        if (covered >= 1) {
          return appendSquadRangeBandToOption({
            typed,
            seriesRaw,
            xData,
            mins,
            maxes,
            spreads,
            language,
          })
        }
      }
    }
  }

  let members: MemberSeriesView[] = []
  let hasTeam = false

  if (xData && xData.length >= 1) {
    const inline = memberSeriesFromInline(lineSeries, xData.length)
    members = inline.members
    hasTeam = inline.hasTeam
  }

  if (members.length < 2) {
    const fromDataset = memberSeriesFromDataset(typed, lineSeries)
    if (fromDataset) {
      members = fromDataset.members
      hasTeam = hasTeam || fromDataset.hasTeam
      if (!xData || xData.length < 1) xData = fromDataset.xData
    }
  }

  if (!xData || xData.length < 1 || members.length < 2) {
    return stripSquadRangeBandSeries(option)
  }

  hasTeam =
    hasTeam || lineSeries.some((entry) => isEnvelopeStatLine(String(entry.name ?? '')))

  if (!hasTeam) {
    const meanName = language === 'fr' ? 'Moyenne équipe' : 'Team mean'
    const meanData = xData.map((_, i) => {
      const values = members
        .map((entry) => entry.data[i])
        .filter((n): n is number => typeof n === 'number' && Number.isFinite(n))
      if (values.length === 0) return null
      return Math.round((values.reduce((sum, n) => sum + n, 0) / values.length) * 1000) / 1000
    })
    seriesRaw.push({
      name: meanName,
      type: 'line',
      data: meanData,
      z: 5,
      lineStyle: { width: 3.1 },
      showSymbol: xData.length <= 3,
      symbol: xData.length <= 3 ? 'circle' : 'none',
    })
    hasTeam = true
  }

  if (!(hasTeam && members.length >= 2)) return stripSquadRangeBandSeries(option)

  const mins: Array<number | null> = []
  const maxes: Array<number | null> = []
  const spreads: Array<number | null> = []
  let coveredDays = 0
  for (let i = 0; i < xData.length; i += 1) {
    const values: number[] = []
    for (const entry of members) {
      const n = entry.data[i]
      if (typeof n === 'number' && Number.isFinite(n)) values.push(n)
    }
    if (values.length < 2) {
      mins.push(null)
      maxes.push(null)
      spreads.push(null)
      continue
    }
    const lo = Math.min(...values)
    const hi = Math.max(...values)
    mins.push(Math.round(lo * 1000) / 1000)
    maxes.push(Math.round(hi * 1000) / 1000)
    spreads.push(Math.round((hi - lo) * 1000) / 1000)
    if (hi > lo) coveredDays += 1
  }
  if (coveredDays < 1) return { ...typed, series: seriesRaw }

  return appendSquadRangeBandToOption({
    typed,
    seriesRaw,
    xData,
    mins,
    maxes,
    spreads,
    language,
  })
}

const polishAxisForPrint = (axis: unknown): unknown => {
  if (Array.isArray(axis)) return axis.map(polishAxisForPrint)
  if (!isPlainRecord(axis)) return axis
  const prevLabel = isPlainRecord(axis.axisLabel) ? axis.axisLabel : {}
  const prevSplit = isPlainRecord(axis.splitLine) ? axis.splitLine : {}
  const prevSplitStyle = isPlainRecord(prevSplit.lineStyle) ? prevSplit.lineStyle : {}
  const prevLine = isPlainRecord(axis.axisLine) ? axis.axisLine : {}
  const prevLineStyle = isPlainRecord(prevLine.lineStyle) ? prevLine.lineStyle : {}
  return {
    ...axis,
    axisLabel: {
      color: '#64748b',
      fontSize: 10,
      hideOverlap: true,
      ...prevLabel,
    },
    axisTick: { show: false, ...(isPlainRecord(axis.axisTick) ? axis.axisTick : {}) },
    axisLine: {
      ...prevLine,
      lineStyle: { color: '#e2e8f0', width: 1, ...prevLineStyle },
    },
    splitLine: {
      ...prevSplit,
      show: prevSplit.show ?? (axis.type === 'category' ? false : true),
      lineStyle: { color: '#f1f5f9', width: 1, type: 'solid', ...prevSplitStyle },
    },
  }
}

const polishSeriesForPrint = (series: unknown[]): unknown[] =>
  series.map((entry) => {
    if (!isPlainRecord(entry)) return entry
    const name = String(entry.name ?? '')
    const cleaned = name.startsWith('_') ? { ...entry, name: '' } : entry
    const type = String(cleaned.type ?? 'line')
    if (type === 'line') {
      const prevLine = isPlainRecord(cleaned.lineStyle) ? cleaned.lineStyle : {}
      const prevEmphasis = isPlainRecord(cleaned.emphasis) ? cleaned.emphasis : {}
      return {
        ...cleaned,
        smooth: cleaned.smooth ?? 0.18,
        showSymbol: false,
        symbol: 'none',
        symbolSize: 0,
        connectNulls: cleaned.connectNulls ?? false,
        lineStyle: { width: 2.35, ...prevLine },
        emphasis: {
          focus: 'series',
          lineStyle: { width: 3.1 },
          ...prevEmphasis,
        },
      }
    }
    if (type === 'bar') {
      const prevItem = isPlainRecord(cleaned.itemStyle) ? cleaned.itemStyle : {}
      return {
        ...cleaned,
        barMaxWidth: cleaned.barMaxWidth ?? 18,
        itemStyle: {
          borderRadius: prevItem.borderRadius ?? [0, 4, 4, 0],
          ...prevItem,
        },
      }
    }
    if (type === 'scatter') {
      return {
        ...cleaned,
        symbolSize: Math.min(Number(cleaned.symbolSize) || 6, 7),
        itemStyle: {
          opacity: 0.88,
          ...(isPlainRecord(cleaned.itemStyle) ? cleaned.itemStyle : {}),
        },
      }
    }
    return cleaned
  })

const shortenIsoCategoryLabels = (axis: unknown, language: AppLanguage = 'fr'): unknown => {
  if (Array.isArray(axis)) return axis.map((row) => shortenIsoCategoryLabels(row, language))
  if (!isPlainRecord(axis) || axis.type !== 'category' || !Array.isArray(axis.data)) return axis
  const raw = axis.data.map((value) => String(value ?? '').trim()).filter(Boolean)
  const dateLike = raw.filter((value) => looksLikeDateLabel(value))
  if (dateLike.length >= Math.max(2, Math.ceil(raw.length * 0.6))) {
    const isoDates = uniqueSortedIsoDates(raw)
    if (isoDates.length > 0) {
      return { ...axis, data: isoDates.map((iso) => formatIsoDateLabel(iso, language)) }
    }
  }
  const data = axis.data.map((value) => {
    const key = normalizeIsoDate(value)
    return key ? formatIsoDateLabel(key, language) : value
  })
  return { ...axis, data }
}

const SHORT_CATEGORY_RE =
  /^(mon|tue|wed|thu|fri|sat|sun|lun|mar|mer|jeu|ven|sam|dim|gk|cb|cm|st|fw|mf|df|lb|rb|cdm|cam|\d{1,2})$/i

export type SubjectiveChartScale = {
  field: string
  label: string
  isReversed: boolean
  min?: number
  max?: number
}

const foldSubjectiveToken = (value: string): string =>
  value
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')

const subjectiveMetricSegments = (value: string): string[] =>
  value
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .map((part) => part.trim())
    .filter((part) => part.length >= 3)

const matchSubjectiveChartScale = (
  metric: string,
  scales?: SubjectiveChartScale[]
): SubjectiveChartScale | null => {
  if (!scales?.length) return null
  const haySegments = subjectiveMetricSegments(metric)
  if (!haySegments.length) return null
  const hayFolded = foldSubjectiveToken(metric)
  let best: SubjectiveChartScale | null = null
  let bestLen = 0
  for (const scale of scales) {
    const segmentNeedles = [
      ...subjectiveMetricSegments(scale.field),
      ...subjectiveMetricSegments(scale.field.replace(/_rating$/i, '')),
      ...subjectiveMetricSegments(scale.label),
    ]
    for (const token of segmentNeedles) {
      if (!haySegments.includes(token)) continue
      if (token.length > bestLen) {
        best = scale
        bestLen = token.length
      }
    }
    const foldedNeedles = [
      foldSubjectiveToken(scale.field),
      foldSubjectiveToken(scale.field.replace(/_rating$/i, '')),
      foldSubjectiveToken(scale.label),
    ]
    for (const token of foldedNeedles) {
      if (token.length < 6) continue
      if (!hayFolded.includes(token) && !token.includes(hayFolded)) continue
      if (token.length > bestLen) {
        best = scale
        bestLen = token.length
      }
    }
  }
  return best
}

const readBarCategoryLabels = (option: EchartsOption): string[] => {
  const fromAxis = (axis: unknown): string[] => {
    if (Array.isArray(axis)) {
      for (const entry of axis) {
        const labels = fromAxis(entry)
        if (labels.length) return labels
      }
      return []
    }
    if (!isPlainRecord(axis) || axis.type !== 'category' || !Array.isArray(axis.data)) return []
    return axis.data.map((value) => String(value ?? '').trim()).filter(Boolean)
  }
  const axisLabels = fromAxis(option.yAxis).length ? fromAxis(option.yAxis) : fromAxis(option.xAxis)
  if (axisLabels.length) return axisLabels
  const dataset = isPlainRecord(option.dataset) ? option.dataset : null
  const source = dataset && Array.isArray(dataset.source) ? dataset.source : null
  if (!source || source.length < 2 || !Array.isArray(source[0])) return []
  const header = source[0] as unknown[]
  const series0 = asSeriesList(option.series)[0]
  const encode = series0 && isPlainRecord(series0.encode) ? series0.encode : null
  const catKey = String(encode?.y ?? encode?.x ?? header[0] ?? '')
  const catIdx = header.findIndex((col) => String(col) === catKey)
  const idx = catIdx >= 0 ? catIdx : 0
  return source
    .slice(1)
    .map((row) => (Array.isArray(row) ? String(row[idx] ?? '').trim() : ''))
    .filter(Boolean)
}

const barMetricHint = (option: EchartsOption, title = ''): string =>
  [
    title,
    ...asSeriesList(option.series).map((entry) => String(entry.name ?? '')),
    isPlainRecord(option.xAxis) ? String(option.xAxis.name ?? '') : '',
    isPlainRecord(option.yAxis) ? String(option.yAxis.name ?? '') : '',
  ]
    .filter(Boolean)
    .join(' ')

export const resolveBarOrientation = (
  option: EchartsOption,
  _title = ''
): 'horizontal' | 'vertical' => {
  const explicit = option.maunaBarOrientation ?? option.orientation
  if (explicit === 'horizontal' || explicit === 'vertical') return explicit

  const labels = readBarCategoryLabels(option)
  const avgLen = labels.length
    ? labels.reduce((sum, label) => sum + label.length, 0) / labels.length
    : 0
  const personLike = labels.filter((label) => {
    const parts = label.split(/\s+/).filter(Boolean)
    return parts.length >= 2 && label.length >= 8
  }).length
  const personRatio = labels.length ? personLike / labels.length : 0
  const shortCats =
    labels.length > 0 &&
    labels.every((label) => label.length <= 4 || SHORT_CATEGORY_RE.test(label) || /^\d+$/.test(label))

  if (personRatio >= 0.45 || avgLen >= 10) return 'horizontal'
  if (shortCats && labels.length <= 8) return 'vertical'
  if (labels.length > 0 && labels.length <= 6) return 'vertical'
  if (labels.length >= 8) return 'horizontal'
  return 'vertical'
}

const isBarCategoryOnY = (option: EchartsOption): boolean => {
  const yAxis = option.yAxis
  return !Array.isArray(yAxis) && isPlainRecord(yAxis) && yAxis.type === 'category'
}

const flipBarMarkLine = (
  entry: EchartsSeriesItem,
  toHorizontal: boolean
): EchartsSeriesItem => {
  const mark = entry.markLine
  if (!isPlainRecord(mark) || !Array.isArray(mark.data)) return entry
  const data = mark.data.map((row) => {
    if (!isPlainRecord(row)) return row
    if (toHorizontal && row.yAxis != null && row.xAxis == null) {
      const { yAxis: yVal, ...rest } = row
      return { ...rest, xAxis: yVal }
    }
    if (!toHorizontal && row.xAxis != null && row.yAxis == null) {
      const { xAxis: xVal, ...rest } = row
      return { ...rest, yAxis: xVal }
    }
    return row
  })
  return { ...entry, markLine: { ...mark, data } }
}

const applyBarBorderRadius = (
  entry: EchartsSeriesItem,
  horizontal: boolean
): EchartsSeriesItem => {
  const prevItem = isPlainRecord(entry.itemStyle) ? entry.itemStyle : {}
  return {
    ...entry,
    type: 'bar',
    barMaxWidth: entry.barMaxWidth ?? (horizontal ? 18 : 28),
    itemStyle: {
      borderRadius: horizontal ? [0, 4, 4, 0] : [4, 4, 0, 0],
      ...prevItem,
    },
  }
}

const flipBarsOrientation = (
  option: EchartsOption,
  toHorizontal: boolean
): EchartsOption => {
  const seriesRaw = Array.isArray(option.series) ? option.series : []
  const xAxis = option.xAxis
  const yAxis = option.yAxis
  if (Array.isArray(xAxis) || Array.isArray(yAxis)) return option
  if (!isPlainRecord(xAxis) || !isPlainRecord(yAxis)) return option

  const series = seriesRaw.map((entry) => {
    if (!isPlainRecord(entry)) return entry
    const encode = isPlainRecord(entry.encode) ? entry.encode : null
    const flippedEncode = encode
      ? { x: encode.y ?? encode.x, y: encode.x ?? encode.y }
      : entry.encode
    return applyBarBorderRadius(
      flipBarMarkLine({ ...entry, encode: flippedEncode }, toHorizontal),
      toHorizontal
    )
  })

  if (toHorizontal) {
    const prevCatLabel = isPlainRecord(xAxis.axisLabel) ? xAxis.axisLabel : {}
    return {
      ...option,
      maunaBarOrientation: 'horizontal',
      xAxis: {
        type: 'value',
        axisLabel: { color: '#64748b', fontSize: 10 },
        axisTick: { show: false },
        splitLine: { lineStyle: { color: '#e2e8f0', width: 1 } },
        ...(yAxis.type === 'value' ? { min: yAxis.min, max: yAxis.max } : {}),
      },
      yAxis: {
        ...xAxis,
        type: 'category',
        axisLabel: {
          ...prevCatLabel,
          rotate: 0,
          hideOverlap: true,
          color: '#0f172a',
          fontSize: 11,
        },
        axisTick: { show: false },
      },
      grid: {
        left: 8,
        top: 36,
        bottom: 16,
        containLabel: true,
        ...(isPlainRecord(option.grid) ? option.grid : {}),
        right: Math.max(
          72,
          Number(isPlainRecord(option.grid) ? option.grid.right : 0) || 0
        ),
      },
      series,
    }
  }

  const prevCatLabel = isPlainRecord(yAxis.axisLabel) ? yAxis.axisLabel : {}
  const labels = readBarCategoryLabels(option)
  const rotate = labels.some((label) => label.length > 6) ? 30 : 0
  return {
    ...option,
    maunaBarOrientation: 'vertical',
    xAxis: {
      ...yAxis,
      type: 'category',
      axisLabel: {
        ...prevCatLabel,
        rotate,
        hideOverlap: true,
        color: '#0f172a',
        fontSize: 11,
      },
      axisTick: { show: false },
    },
    yAxis: {
      type: 'value',
      axisLabel: { color: '#64748b', fontSize: 10 },
      axisTick: { show: false },
      splitLine: { lineStyle: { color: '#e2e8f0', width: 1 } },
      ...(xAxis.type === 'value' ? { min: xAxis.min, max: xAxis.max } : {}),
    },
    grid: {
      left: 48,
      right: 24,
      top: 36,
      bottom: rotate ? 56 : 28,
      containLabel: true,
      ...(isPlainRecord(option.grid) ? option.grid : {}),
    },
    series,
  }
}

const orientBarsByContext = (option: EchartsOption, title = ''): EchartsOption => {
  const seriesRaw = Array.isArray(option.series) ? option.series : []
  if (!seriesRaw.length) return option
  const hasLine = seriesRaw.some(
    (entry) => isPlainRecord(entry) && String(entry.type ?? '') === 'line'
  )
  const allBars = seriesRaw.every(
    (entry) => isPlainRecord(entry) && (String(entry.type ?? 'bar') === 'bar' || entry.type == null)
  )
  if (hasLine || !allBars) return option

  const wantHorizontal = resolveBarOrientation(option, title) === 'horizontal'
  const currentlyHorizontal = isBarCategoryOnY(option)
  if (wantHorizontal === currentlyHorizontal) {
    return {
      ...option,
      maunaBarOrientation: wantHorizontal ? 'horizontal' : 'vertical',
      series: seriesRaw.map((entry) =>
        isPlainRecord(entry) ? applyBarBorderRadius(entry, wantHorizontal) : entry
      ),
    }
  }
  return flipBarsOrientation(option, wantHorizontal)
}

const readBarNumericExtent = (
  option: EchartsOption,
  seriesRaw: ReturnType<typeof asSeriesList>
): { min: number; max: number; source: unknown[] | null } => {
  let min = Number.POSITIVE_INFINITY
  let max = Number.NEGATIVE_INFINITY
  for (const entry of seriesRaw) {
    if (!Array.isArray(entry.data)) continue
    for (const point of entry.data) {
      const n =
        typeof point === 'number'
          ? point
          : isPlainRecord(point) && typeof point.value === 'number'
            ? point.value
            : null
      if (n == null || !Number.isFinite(n)) continue
      if (n < min) min = n
      if (n > max) max = n
    }
  }
  const dataset = isPlainRecord(option.dataset) ? option.dataset : null
  const source = dataset && Array.isArray(dataset.source) ? dataset.source : null
  if ((!Number.isFinite(min) || !Number.isFinite(max)) && source && source.length >= 2) {
    const header = Array.isArray(source[0]) ? (source[0] as unknown[]) : []
    const series0 = seriesRaw[0]
    const encode = series0 && isPlainRecord(series0.encode) ? series0.encode : null
    const valKey = String(
      (isBarCategoryOnY(option) ? encode?.x : encode?.y) ?? header[1] ?? ''
    )
    const valIdx = header.findIndex((col) => String(col) === valKey)
    const idx = valIdx >= 0 ? valIdx : 1
    for (const row of source.slice(1)) {
      if (!Array.isArray(row)) continue
      const n = Number(row[idx])
      if (!Number.isFinite(n)) continue
      if (n < min) min = n
      if (n > max) max = n
    }
  }
  return { min, max, source }
}

const resolveSubjectiveScale = (
  dataMin: number,
  dataMax: number
): { scaleMin: number; scaleMax: number } => {
  if (!Number.isFinite(dataMin) || !Number.isFinite(dataMax)) {
    return { scaleMin: 1, scaleMax: 5 }
  }
  if (dataMin >= 0 && dataMax <= 5.5) return { scaleMin: 1, scaleMax: 5 }
  if (dataMin >= 0 && dataMax <= 10.5) return { scaleMin: 1, scaleMax: 10 }
  const pad = Math.max(0.5, (dataMax - dataMin) * 0.05)
  return {
    scaleMin: Math.floor(dataMin - pad),
    scaleMax: Math.ceil(dataMax + pad),
  }
}

const withoutBarVisualMap = (option: EchartsOption): EchartsOption => {
  if (option.visualMap == null) return option
  const { visualMap: _removed, ...rest } = option
  return rest
}

const applySubjectiveBarVisualMap = (
  option: EchartsOption,
  title = '',
  scales?: SubjectiveChartScale[]
): EchartsOption => {
  const seriesRaw = asSeriesList(option.series)
  if (!seriesRaw.some((entry) => String(entry.type ?? 'bar') === 'bar')) return option

  const metric = barMetricHint(option, title)
  const matched = matchSubjectiveChartScale(metric, scales)
  if (!matched) return withoutBarVisualMap(option)

  const { min: dataMin, max: dataMax, source } = readBarNumericExtent(option, seriesRaw)
  const resolved = resolveSubjectiveScale(dataMin, dataMax)
  const scaleMin = Number.isFinite(matched.min) ? Number(matched.min) : resolved.scaleMin
  const scaleMax = Number.isFinite(matched.max) ? Number(matched.max) : resolved.scaleMax
  if (
    Number.isFinite(dataMax) &&
    Number.isFinite(scaleMax) &&
    dataMax > scaleMax * 1.5
  ) {
    return withoutBarVisualMap(option)
  }
  const span = Math.max(scaleMax - scaleMin, 1e-6)
  const lowEnd = scaleMin + span / 3
  const highStart = scaleMin + (2 * span) / 3
  const highIsWorse = !matched.isReversed
  const lowColor = highIsWorse ? '#22c55e' : '#ef4444'
  const midColor = '#eab308'
  const highColor = highIsWorse ? '#ef4444' : '#22c55e'
  const lowLabel = highIsWorse ? 'Better' : 'Worse'
  const midLabel = 'Mid'
  const highLabel = highIsWorse ? 'Worse' : 'Better'

  let dimension: number | undefined
  if (source && Array.isArray(source[0])) {
    const header = source[0] as unknown[]
    const series0 = seriesRaw[0]
    const encode = series0 && isPlainRecord(series0.encode) ? series0.encode : null
    const valKey = String(
      (isBarCategoryOnY(option) ? encode?.x : encode?.y) ?? header[1] ?? ''
    )
    const valIdx = header.findIndex((col) => String(col) === valKey)
    if (valIdx >= 0) dimension = valIdx
  }

  const seriesCount = seriesRaw.filter(
    (entry) => String(entry.type ?? 'bar') === 'bar' && !String(entry.name ?? '').startsWith('_')
  ).length

  return {
    ...option,
    legend: seriesCount <= 1 ? { show: false } : option.legend,
    visualMap: {
      type: 'piecewise',
      show: true,
      min: scaleMin,
      max: scaleMax,
      calculable: false,
      orient: 'horizontal',
      top: 2,
      left: 'center',
      itemWidth: 12,
      itemHeight: 8,
      itemGap: 10,
      textStyle: { fontSize: 10, color: '#475569' },
      ...(dimension != null ? { dimension } : {}),
      pieces: [
        { min: scaleMin, max: lowEnd, color: lowColor, label: lowLabel },
        { min: lowEnd, max: highStart, color: midColor, label: midLabel },
        { min: highStart, max: scaleMax, color: highColor, label: highLabel },
      ],
    },
  }
}

const pruneEmptyBarCategoriesInOption = (option: EchartsOption): EchartsOption => {
  const seriesRaw = Array.isArray(option.series) ? option.series : []
  const barSeries = seriesRaw.filter(
    (entry) => isPlainRecord(entry) && String(entry.type ?? 'bar') === 'bar'
  )
  if (!barSeries.length) return option

  const dataset = isPlainRecord(option.dataset) ? option.dataset : null
  const source = dataset && Array.isArray(dataset.source) ? dataset.source : null
  if (source && source.length >= 2 && Array.isArray(source[0])) {
    const header = source[0] as unknown[]
    const encode = isPlainRecord(barSeries[0]) ? barSeries[0].encode : null
    const enc = isPlainRecord(encode) ? encode : null
    const catKey = String(enc?.y ?? enc?.x ?? header[0] ?? '')
    const valKey = String(enc?.x ?? enc?.y ?? header[1] ?? '')
    const catIdx = header.findIndex((col) => String(col) === catKey)
    const valIdx = header.findIndex((col) => String(col) === valKey)
    if (catIdx >= 0 && valIdx >= 0 && catIdx !== valIdx) {
      const kept = [header as unknown[]].concat(
        source.slice(1).filter((row) => {
          if (!Array.isArray(row)) return false
          const n = Number(row[valIdx])
          return Number.isFinite(n)
        }) as unknown[][]
      )
      if (kept.length >= 2) {
        return { ...option, dataset: { ...dataset, source: kept } }
      }
    }
  }

  const yAxis = option.yAxis
  const xAxis = option.xAxis
  const yIsCat = isPlainRecord(yAxis) && yAxis.type === 'category' && Array.isArray(yAxis.data)
  const xIsCat = isPlainRecord(xAxis) && xAxis.type === 'category' && Array.isArray(xAxis.data)
  if (!yIsCat && !xIsCat) return option

  const catAxis = yIsCat ? yAxis : xAxis
  if (!isPlainRecord(catAxis) || !Array.isArray(catAxis.data)) return option
  const cats = catAxis.data as unknown[]
  const primary = barSeries[0]
  if (!isPlainRecord(primary) || !Array.isArray(primary.data)) return option
  const values = primary.data as unknown[]
  if (values.length !== cats.length) return option

  const keepIdx: number[] = []
  for (let i = 0; i < cats.length; i++) {
    const cell = values[i]
    const n =
      typeof cell === 'number'
        ? cell
        : Array.isArray(cell)
          ? Number(cell[0])
          : cell && typeof cell === 'object' && 'value' in cell
            ? Number((cell as { value: unknown }).value)
            : Number(cell)
    if (Number.isFinite(n)) keepIdx.push(i)
  }
  if (keepIdx.length === cats.length || keepIdx.length === 0) return option

  const nextSeries = seriesRaw.map((entry) => {
    if (!isPlainRecord(entry) || !Array.isArray(entry.data)) return entry
    const data = entry.data as unknown[]
    if (data.length !== cats.length) return entry
    return { ...entry, data: keepIdx.map((i) => data[i]) }
  })
  const nextCats = keepIdx.map((i) => cats[i])
  return {
    ...option,
    series: nextSeries,
    ...(yIsCat && isPlainRecord(yAxis) ? { yAxis: { ...yAxis, data: nextCats } } : {}),
    ...(xIsCat && isPlainRecord(xAxis) ? { xAxis: { ...xAxis, data: nextCats } } : {}),
  }
}

export const lineChartNeedsTimeAxisRepair = (option: EchartsOption): boolean => {
  const typed = option
  const hasLine = asSeriesList(typed.series).some(
    (entry) => String(entry.type ?? '') === 'line'
  )
  if (!hasLine) return false
  const xAxis = typed.xAxis
  if (Array.isArray(xAxis)) return false
  if (!isPlainRecord(xAxis)) return true
  if (xAxis.type === 'time') return false
  if (xAxis.type === 'value') return true
  if (xAxis.type === 'category' && Array.isArray(xAxis.data) && xAxis.data.length > 0) {
    if (xAxis.data.some(looksLikeDateLabel)) return false
    const numeric = xAxis.data.filter((value) => toNumber(value) != null).length
    return numeric > xAxis.data.length * 0.7
  }
  return true
}

const buildMultiMetricLineOption = (args: {
  rows: Array<Record<string, unknown>>
  dateColumn: string
  valueColumns: string[]
  refLines: ChartRefLines
  language: AppLanguage
}): EchartsOption => {
  const { rows, dateColumn, valueColumns, refLines, language } = args
  const dates = uniqueSortedIsoDates(rows.map((row) => row[dateColumn]))
  const fewPoints = dates.length <= 3
  const primary = valueColumns[0]!
  const markRows = rows.map((row) => ({ [primary]: row[primary] }))
  const marks = buildRefLines(markRows, primary, 'yAxis', refLines, language)
  return {
    legend: {
      top: 2,
      type: 'plain',
      left: 'center',
      width: '94%',
      itemWidth: 12,
      itemHeight: 8,
      itemGap: valueColumns.length > 3 ? 8 : 12,
      icon: 'roundRect',
      textStyle: { fontSize: 10, color: '#475569' },
    },
    grid: {
      left: 48,
      right: 56,
      top: valueColumns.length > 3 ? 64 : 52,
      bottom: 64,
      containLabel: true,
    },
    xAxis: {
      type: 'category',
      data: dates,
      axisLabel: { rotate: 35, hideOverlap: true, color: '#64748b', fontSize: 10 },
      axisTick: { show: false },
      axisLine: { lineStyle: { color: '#e2e8f0' } },
    },
    yAxis: namedValueAxis(primary),
    tooltip: axisTooltip,
    series: valueColumns.map((column, index) => {
      const isMean = isEnvelopeStatSeriesName(column, 'mean') || isTeamAggregateSeriesName(column)
      const isBandEdge =
        isEnvelopeStatSeriesName(column, 'min') || isEnvelopeStatSeriesName(column, 'max')
      return attachRefLines(
        {
          name: column,
          type: 'line',
          data: dates.map((date) => {
            const row = rows.find((entry) => normalizeIsoDate(entry[dateColumn]) === date)
            return row ? (toNumber(row[column]) ?? null) : null
          }),
          connectNulls: false,
          smooth: 0.18,
          showSymbol: fewPoints && isMean,
          symbol: fewPoints && isMean ? 'circle' : 'none',
          lineStyle: {
            width: isMean ? 3.1 : isBandEdge ? 1.15 : 2.35,
            ...(isBandEdge ? { type: 'dashed' as const, color: '#94a3b8' } : {}),
          },
          emphasis: { focus: 'series', lineStyle: { width: isMean ? 3.6 : 3.1 } },
        },
        index === 0 ? marks : []
      )
    }),
  }
}

export const rebuildLineChartFromRows = (
  dataset: { columns: string[]; rows: Array<Record<string, unknown>> },
  language: AppLanguage = 'fr',
  prefer?: { title?: string; column?: string }
): EchartsOption | null => {
  const dateColumn = pickDateColumn(dataset.columns)
  if (!dateColumn) return null
  const values = pickValueColumns(dataset as PremiumDataset, dateColumn)
  const groupColumn = pickSeriesGroupColumn(dataset.columns)
  const groups = groupColumn
    ? [
        ...new Set(
          dataset.rows.map((row) => String(row[groupColumn] ?? '').trim()).filter(Boolean)
        ),
      ].sort((left, right) => left.localeCompare(right))
    : []
  const metrics =
    groups.length > 1
      ? preferLineMetric(values, prefer)
      : resolveSingleGrainLineMetrics(values, dataset.rows, prefer)
  if (metrics.length === 0) return null
  if (groups.length > 1) {
    return buildMultiGroupLineOption({
      rows: dataset.rows,
      dateColumn,
      groupColumn,
      valueColumn: metrics[0]!,
      groups,
      refLines: 'none',
      language,
    })
  }
  if (metrics.length > 1) {
    return buildMultiMetricLineOption({
      rows: dataset.rows,
      dateColumn,
      valueColumns: metrics,
      refLines: 'none',
      language,
    })
  }
  return buildMultiGroupLineOption({
    rows: dataset.rows,
    dateColumn,
    groupColumn: undefined,
    valueColumn: metrics[0]!,
    groups: [metrics[0]!],
    refLines: 'none',
    language,
  })
}

export const sanitizeRadarOptionForPrint = (
  option: EchartsOption,
  seriesPreview: ReturnType<typeof asSeriesList>
): EchartsOption => {
  const radarPrev = isPlainRecord(option.radar) ? option.radar : {}
  const series = seriesPreview.map((entry) => {
    if (!isPlainRecord(entry) || String(entry.type ?? '') !== 'radar') return entry
    const prevArea = isPlainRecord(entry.areaStyle) ? entry.areaStyle : {}
    const prevLine = isPlainRecord(entry.lineStyle) ? entry.lineStyle : {}
    const dataItems = Array.isArray(entry.data) ? entry.data : []
    const multi = dataItems.length > 1
    const data = dataItems.map((item, index) => {
      if (!isPlainRecord(item)) return item
      const color = RADAR_SERIES_COLORS[index % RADAR_SERIES_COLORS.length]!
      const itemArea = isPlainRecord(item.areaStyle) ? item.areaStyle : {}
      const itemLine = isPlainRecord(item.lineStyle) ? item.lineStyle : {}
      const itemStyle = isPlainRecord(item.itemStyle) ? item.itemStyle : {}
      return {
        ...item,
        itemStyle: { color, ...itemStyle },
        areaStyle: { color, opacity: multi ? 0.1 : 0.22, ...itemArea },
        lineStyle: { color, width: 2.2, ...itemLine },
      }
    })
    return {
      ...entry,
      data,
      areaStyle: { opacity: multi ? 0.1 : 0.18, ...prevArea },
      lineStyle: { width: 2.2, ...prevLine },
      symbol: entry.symbol ?? 'circle',
      symbolSize: entry.symbolSize ?? 5,
    }
  })
  return {
    ...option,
    animation: false,
    color: Array.isArray(option.color) ? option.color : [...RADAR_SERIES_COLORS],
    radar: {
      shape: 'polygon',
      splitNumber: 4,
      axisName: {
        color: '#475569',
        fontSize: 11,
        ...(isPlainRecord(radarPrev.axisName) ? radarPrev.axisName : {}),
      },
      splitArea: {
        show: true,
        areaStyle: {
          color: ['rgba(248,250,252,0.9)', 'rgba(241,245,249,0.75)'],
        },
        ...(isPlainRecord(radarPrev.splitArea) ? radarPrev.splitArea : {}),
      },
      axisLine: {
        lineStyle: { color: '#cbd5e1' },
        ...(isPlainRecord(radarPrev.axisLine) ? radarPrev.axisLine : {}),
      },
      splitLine: {
        lineStyle: { color: '#e2e8f0' },
        ...(isPlainRecord(radarPrev.splitLine) ? radarPrev.splitLine : {}),
      },
      ...radarPrev,
    },
    series: series as EchartsSeriesItem[],
    legend: {
      top: 4,
      type: 'plain',
      left: 'center',
      textStyle: { fontSize: 10, color: '#475569' },
      ...(isPlainRecord(option.legend) ? option.legend : {}),
    },
  }
}

const withScatterAxisLabels = (axis: unknown): unknown => {
  if (Array.isArray(axis)) return axis.map(withScatterAxisLabels)
  if (!isPlainRecord(axis)) return axis
  const prevLabel = isPlainRecord(axis.axisLabel) ? axis.axisLabel : {}
  return {
    ...axis,
    scale: axis.scale ?? true,
    axisTick: { show: true, ...(isPlainRecord(axis.axisTick) ? axis.axisTick : {}) },
    axisLabel: {
      show: true,
      color: '#64748b',
      fontSize: 10,
      hideOverlap: true,
      ...prevLabel,
    },
    splitLine: {
      show: true,
      lineStyle: { color: '#f1f5f9' },
      ...(isPlainRecord(axis.splitLine) ? axis.splitLine : {}),
    },
  }
}

export const sanitizeScatterOptionForPrint = (args: {
  policed: EchartsOption
  series: EchartsSeriesItem[]
  prevLegend: Record<string, unknown>
  prevGrid: Record<string, unknown>
  xAxisRaw: unknown
  yAxisRaw: unknown
}): EchartsOption => {
  const { policed, series, prevLegend, prevGrid, xAxisRaw, yAxisRaw } = args
  return {
    ...policed,
    animation: false,
    series,
    legend: { show: false, ...(isPlainRecord(prevLegend) ? prevLegend : {}) },
    grid: {
      containLabel: true,
      left: 56,
      right: 48,
      top: 40,
      bottom: 64,
      ...prevGrid,
    },
    xAxis: withScatterAxisLabels(xAxisRaw) as EchartsAxis,
    yAxis: withScatterAxisLabels(yAxisRaw) as EchartsAxis,
  }
}

export const buildCartesianPrintChartOption = (args: {
  policed: EchartsOption
  series: EchartsSeriesItem[]
  prevLegend: Record<string, unknown>
  prevGrid: Record<string, unknown>
  xAxisRaw: unknown
  yAxis: unknown
  yAxisRaw: unknown
  isLineHeavy: boolean
  lineSeriesCount: number
  legendNames: string[]
}): EchartsOption => {
  const {
    policed,
    series,
    prevLegend,
    prevGrid,
    xAxisRaw,
    yAxis,
    yAxisRaw,
    isLineHeavy,
    lineSeriesCount,
    legendNames,
  } = args
  const isHorizontalBar =
    series.some((entry) => isPlainRecord(entry) && String(entry.type ?? '') === 'bar') &&
    isPlainRecord(yAxisRaw) &&
    yAxisRaw.type === 'category' &&
    isPlainRecord(xAxisRaw) &&
    xAxisRaw.type === 'value'
  let gridRight = Math.max(48, Number(prevGrid.right) || 0)
  if (isHorizontalBar) gridRight = Math.max(72, Number(prevGrid.right) || 0)
  else if (isLineHeavy) gridRight = Math.max(56, Number(prevGrid.right) || 0)
  const hasVisualMap = Boolean(policed.visualMap)
  let gridTop = isLineHeavy ? (lineSeriesCount > 5 ? 64 : 52) : 40
  if (hasVisualMap) gridTop = Math.max(gridTop, 48)
  if (isHorizontalBar && hasVisualMap) gridTop = Math.max(gridTop, 44)

  return {
    ...policed,
    animation: false,
    series,
    legend: hasVisualMap
      ? { show: false }
      : {
          ...prevLegend,
          type: 'plain',
          top: 2,
          left: 'center',
          width: '94%',
          itemWidth: 12,
          itemHeight: 8,
          itemGap: lineSeriesCount > 5 ? 8 : 12,
          icon: 'roundRect',
          pageButtonItemGap: 0,
          pageIconSize: 0,
          pageTextStyle: { color: 'transparent' },
          ...(legendNames.length ? { data: legendNames } : {}),
          textStyle: {
            fontSize: lineSeriesCount > 5 ? 9 : 10,
            color: '#475569',
            ...(isPlainRecord(prevLegend.textStyle) ? prevLegend.textStyle : {}),
          },
        },
    grid: {
      containLabel: true,
      left: isHorizontalBar ? 8 : 48,
      top: gridTop,
      bottom: isLineHeavy ? 64 : isHorizontalBar ? 28 : 52,
      ...prevGrid,
      right: gridRight,
      ...(hasVisualMap ? { top: Math.max(gridTop, Number(prevGrid.top) || 0) } : {}),
    },
    xAxis: xAxisRaw as EchartsAxis,
    yAxis: yAxis as EchartsAxis,
  }
}

export const sanitizeChartOptionForPrint = (
  option: EchartsOption,
  chartTitle = '',
  scales?: SubjectiveChartScale[],
  language: AppLanguage = 'fr'
): EchartsOption => {
  const isRadar = Boolean((option as { radar?: unknown }).radar)
  const seriesPreview = asSeriesList(option.series)
  const isScatter = seriesPreview.some(
    (entry) => isPlainRecord(entry) && String(entry.type ?? '') === 'scatter'
  )

  if (isRadar) return sanitizeRadarOptionForPrint(option, seriesPreview)

  const repaired = lineChartNeedsTimeAxisRepair(option)
    ? (() => {
        const records = recordsFromDatasetSource(option)
        return records ? rebuildLineChartFromRows(records, language, { title: chartTitle }) : null
      })()
    : null
  const working = repaired ?? option
  const layoutHint =
    typeof (working as { maunaLayout?: unknown }).maunaLayout === 'string'
      ? String((working as { maunaLayout?: string }).maunaLayout)
      : undefined
  const keepSquadBand = isMeanOnlyLineChart(
    asSeriesList(working.series),
    chartTitle,
    layoutHint
  )
  const prunedBars = pruneEmptyBarCategoriesInOption(
    keepSquadBand ? working : (stripSquadRangeBandSeries(working) as EchartsOption)
  )
  const oriented = orientBarsByContext(prunedBars, chartTitle)
  const policed = applySubjectiveBarVisualMap(oriented, chartTitle, scales)
  const seriesRaw = Array.isArray(policed.series) ? policed.series : []
  const series = polishSeriesForPrint(seriesRaw) as EchartsSeriesItem[]

  const legendNames = [
    ...new Set(
      series
        .map((entry) => (isPlainRecord(entry) ? String(entry.name ?? '').trim() : ''))
        .filter((name) => Boolean(name) && !name.startsWith('_'))
    ),
  ]

  const prevLegend = isPlainRecord(policed.legend) ? policed.legend : {}
  const isLineHeavy = series.some(
    (entry) => isPlainRecord(entry) && String(entry.type ?? 'line') === 'line'
  )
  const lineSeriesCount = series.filter(
    (entry) => isPlainRecord(entry) && String(entry.type ?? 'line') === 'line'
  ).length
  const prevGrid = isPlainRecord(policed.grid) ? policed.grid : {}
  const yAxisRaw = shortenIsoCategoryLabels(polishAxisForPrint(policed.yAxis), language)
  let xAxisRaw = shortenIsoCategoryLabels(polishAxisForPrint(policed.xAxis), language)
  if (isLineHeavy && isPlainRecord(xAxisRaw) && xAxisRaw.type === 'value') {
    xAxisRaw = { ...xAxisRaw, name: '' }
  }
  const yAxis =
    isLineHeavy && isPlainRecord(yAxisRaw) && yAxisRaw.type !== 'category'
      ? { ...yAxisRaw, scale: yAxisRaw.scale ?? true }
      : yAxisRaw

  if (isScatter) {
    return sanitizeScatterOptionForPrint({
      policed,
      series,
      prevLegend,
      prevGrid,
      xAxisRaw,
      yAxisRaw,
    })
  }

  return buildCartesianPrintChartOption({
    policed,
    series,
    prevLegend,
    prevGrid,
    xAxisRaw,
    yAxis,
    yAxisRaw,
    isLineHeavy,
    lineSeriesCount,
    legendNames,
  })
}

const buildMultiGroupLineOption = (args: {
  rows: Array<Record<string, unknown>>
  dateColumn: string
  groupColumn?: string
  valueColumn: string
  groups: string[]
  refLines: ChartRefLines
  language: AppLanguage
}): EchartsOption => {
  const { rows, dateColumn, groupColumn, valueColumn, groups, refLines, language } = args
  const dates = uniqueSortedIsoDates(rows.map((row) => row[dateColumn]))
  const fallbackGroup = groups[0] ?? valueColumn
  const valueByGroupDate = new Map<string, number>()
  for (const row of rows) {
    const group = groupColumn ? String(row[groupColumn] ?? '').trim() : fallbackGroup
    const date = normalizeIsoDate(row[dateColumn])
    if (!group || !date) continue
    const numeric = toNumber(row[valueColumn])
    if (numeric == null) continue
    valueByGroupDate.set(`${group}\0${date}`, numeric)
  }
  const flatValues = groups.flatMap((group) =>
    dates
      .map((date) => valueByGroupDate.get(`${group}\0${date}`))
      .filter((value): value is number => value != null)
  )
  const fewPoints = dates.length <= 3
  const markRows = flatValues.map((value) => ({ [valueColumn]: value }))
  const marks = buildRefLines(markRows, valueColumn, 'yAxis', refLines, language)
  const base: EchartsOption = {
    legend: {
      top: 2,
      type: 'plain',
      left: 'center',
      width: '94%',
      itemWidth: 12,
      itemHeight: 8,
      itemGap: groups.length > 5 ? 8 : 12,
      icon: 'roundRect',
      textStyle: { fontSize: groups.length > 5 ? 9 : 10, color: '#475569' },
    },
    grid: {
      left: 48,
      right: 56,
      top: groups.length > 5 ? 64 : 52,
      bottom: 64,
      containLabel: true,
    },
    xAxis: {
      type: 'category',
      data: dates,
      axisLabel: { rotate: 35, hideOverlap: true, color: '#64748b', fontSize: 10 },
      axisTick: { show: false },
      axisLine: { lineStyle: { color: '#e2e8f0' } },
    },
    yAxis: namedValueAxis(valueColumn),
    tooltip: axisTooltip,
    series: groups.map((group, index) =>
      attachRefLines(
        {
          name: group,
          type: 'line',
          data: dates.map((date) => valueByGroupDate.get(`${group}\0${date}`) ?? null),
          connectNulls: false,
          smooth: 0.18,
          showSymbol: fewPoints,
          symbol: fewPoints ? 'circle' : 'none',
          lineStyle: { width: 2.35 },
          emphasis: { focus: 'series', lineStyle: { width: 3.1 } },
        },
        index === 0 ? marks : []
      )
    ),
  }
  return base
}


export const buildScatterPresetOption = (args: {
  category: string
  y: string
  y2: string
  rows?: Array<Record<string, unknown>>
  refLines: ChartRefLines
  language: AppLanguage
}): EchartsOption => {
  const { category, y, y2, rows, refLines, language } = args
  const markData = rows?.length
    ? [
        ...buildRefLines(rows, y, 'xAxis', refLines, language),
        ...buildRefLines(rows, y2, 'yAxis', refLines, language),
      ]
    : []
  return {
    legend: { show: false },
    grid: { left: 64, right: 56, top: 48, bottom: 72, containLabel: true },
    xAxis: {
      type: 'value',
      name: y,
      scale: true,
      nameLocation: 'middle',
      nameGap: 32,
      axisTick: { show: true },
      axisLabel: { show: true, color: '#64748b', fontSize: 10, hideOverlap: true },
      splitLine: { show: true, lineStyle: { color: '#f1f5f9' } },
    },
    yAxis: {
      type: 'value',
      name: y2,
      scale: true,
      nameLocation: 'middle',
      nameGap: 44,
      axisTick: { show: true },
      axisLabel: { show: true, color: '#64748b', fontSize: 10, hideOverlap: true },
      splitLine: { show: true, lineStyle: { color: '#f1f5f9' } },
    },
    tooltip: { trigger: 'item' },
    series: [
      attachRefLines(
        {
          type: 'scatter',
          symbolSize: 7,
          encode: {
            x: y,
            y: y2,
            tooltip: category ? [category, y, y2] : [y, y2],
          },
        },
        markData
      ),
    ],
  }
}

export const buildRadarPresetOption = (args: {
  category: string
  values: string[]
  rows: Array<Record<string, unknown>>
  language: AppLanguage
}): EchartsOption => {
  const { category, values, rows, language } = args
  const limited = rows.slice(0, PREMIUM_RADAR_MAX_SERIES)
  const indicator = values.map((col) => {
    let max = 0
    for (const row of limited) {
      const n = toNumber(row[col])
      if (n != null && n > max) max = n
    }
    return {
      name: displayColumnLabel(col, language),
      max: max > 0 ? Math.ceil(max * 1.15 * 1000) / 1000 : 1,
    }
  })
  const multi = limited.length > 1
  return {
    color: [...RADAR_SERIES_COLORS],
    legend: { top: 4, type: 'plain', left: 'center', textStyle: { fontSize: 10 } },
    tooltip: { trigger: 'item' },
    radar: {
      indicator,
      shape: 'polygon',
      radius: '62%',
      center: ['50%', '55%'],
      splitNumber: 4,
      axisName: { color: '#475569', fontSize: 11 },
      splitArea: {
        show: true,
        areaStyle: { color: ['rgba(248,250,252,0.95)', 'rgba(241,245,249,0.8)'] },
      },
      axisLine: { lineStyle: { color: '#cbd5e1' } },
      splitLine: { lineStyle: { color: '#e2e8f0' } },
    },
    series: [
      {
        type: 'radar',
        symbol: 'circle',
        symbolSize: 5,
        areaStyle: { opacity: multi ? 0.1 : 0.2 },
        lineStyle: { width: 2.2 },
        data: limited.map((row, index) => {
          const color = RADAR_SERIES_COLORS[index % RADAR_SERIES_COLORS.length]!
          return {
            name: String(row[category] ?? ''),
            value: values.map((col) => toNumber(row[col]) ?? 0),
            itemStyle: { color },
            lineStyle: { color, width: 2.2 },
            areaStyle: { color, opacity: multi ? 0.1 : 0.22 },
          }
        }),
      },
    ],
  }
}

export const buildDonutPresetOption = (category: string, y: string | undefined): EchartsOption => ({
  tooltip: { trigger: 'item' },
  legend: { bottom: 0 },
  series: [
    {
      type: 'pie',
      radius: ['42%', '68%'],
      encode: { itemName: category, value: y },
      label: { formatter: '{b}\n{c}' },
    },
  ],
})

export const buildBarLinePresetOption = (args: {
  category: string
  y: string
  y2: string
  rows?: Array<Record<string, unknown>>
  refLines: ChartRefLines
  language: AppLanguage
}): EchartsOption => {
  const { category, y, y2, rows, refLines, language } = args
  const barRows = rows?.length ? aggregateRowsByCategory(rows, category, [y, y2]) : undefined
  const barMarks = barRows?.length ? buildRefLines(barRows, y, 'yAxis', refLines, language) : []
  return {
    legend: { top: 8 },
    grid: { left: 72, right: 72, top: 44, bottom: 96 },
    xAxis: { type: 'category', axisLabel: { rotate: 40, hideOverlap: true } },
    yAxis: [
      { type: 'value', name: y, minInterval: 1 },
      { type: 'value', name: y2, minInterval: 1 },
    ],
    tooltip: axisTooltip,
    series: [
      attachRefLines({ name: y, type: 'bar', encode: { x: category, y } }, barMarks),
      {
        name: y2,
        type: 'line',
        yAxisIndex: 1,
        encode: { x: category, y: y2 },
        lineStyle: { width: 3 },
      },
    ],
  }
}

export const buildDateLinePresetOption = (args: {
  category: string
  values: string[]
  y: string
  rows: Array<Record<string, unknown>>
  refLines: ChartRefLines
  language: AppLanguage
}): EchartsOption | null => {
  const { category, values, y, rows, refLines, language } = args
  const columns = Object.keys(rows[0] ?? {})
  const groupColumn = pickSeriesGroupColumn(columns)
  const groups = groupColumn
    ? [...new Set(rows.map((row) => String(row[groupColumn] ?? '').trim()).filter(Boolean))].sort(
        (left, right) => left.localeCompare(right)
      )
    : []
  const isDateCategory = Boolean(
    pickDateColumn([category]) || /date|jour|day/i.test(category)
  )
  if (!isDateCategory) return null
  if (groups.length > 1) {
    return buildMultiGroupLineOption({
      rows,
      dateColumn: category,
      groupColumn,
      valueColumn: y,
      groups,
      refLines,
      language,
    })
  }
  if (
    values.length > 1 &&
    (isMeanMinMaxEnvelopeColumns(values) || wantsSquadEnvelopeTitle(String(y)))
  ) {
    return buildMultiMetricLineOption({
      rows,
      dateColumn: category,
      valueColumns: values,
      refLines,
      language,
    })
  }
  if (values.length > 1 && groups.length <= 1) {
    return buildMultiMetricLineOption({
      rows,
      dateColumn: category,
      valueColumns: resolveSingleGrainLineMetrics(values, rows),
      refLines,
      language,
    })
  }
  return buildMultiGroupLineOption({
    rows,
    dateColumn: category,
    groupColumn: undefined,
    valueColumn: y,
    groups: [y],
    refLines,
    language,
  })
}

export const buildBarPresetOption = (args: {
  category: string
  values: string[]
  y: string | undefined
  chartRows?: Array<Record<string, unknown>>
  refLines: ChartRefLines
  language: AppLanguage
}): EchartsOption => {
  const { category, values, y, chartRows, refLines, language } = args
  const metric = values[0] ?? y
  const categoryLabels = (chartRows ?? []).map((row) => String(row[category] ?? '').trim())
  const draft: EchartsOption = {
    legend: {
      top: 4,
      type: 'plain',
      left: 'center',
      textStyle: { fontSize: 10, color: '#475569' },
    },
    xAxis: { type: 'category', data: categoryLabels },
    yAxis: { type: 'value' },
    series: [{ name: metric, type: 'bar', encode: { x: category, y: metric } }],
  }
  if (values.length > 1 && chartRows?.length) {
    const rotate = categoryLabels.some((label) => label.length > 6) ? 30 : 0
    const valueMarks = y ? buildRefLines(chartRows, y, 'yAxis', refLines, language) : []
    return {
      legend: draft.legend,
      grid: { left: 48, right: 24, top: 44, bottom: rotate ? 56 : 28, containLabel: true },
      maunaBarOrientation: 'vertical',
      xAxis: {
        type: 'category',
        axisLabel: { color: '#0f172a', fontSize: 11, hideOverlap: true, rotate },
        axisTick: { show: false },
        axisLine: { lineStyle: { color: '#cbd5e1' } },
      },
      yAxis: {
        type: 'value',
        axisLabel: { color: '#64748b', fontSize: 10 },
        axisTick: { show: false },
        splitLine: { lineStyle: { color: '#e2e8f0', width: 1 } },
      },
      tooltip: { ...axisTooltip, axisPointer: { type: 'shadow' } },
      series: values.map((col, index) =>
        attachRefLines(
          {
            name: col,
            type: 'bar',
            encode: { x: category, y: col },
            barMaxWidth: 22,
            itemStyle: { borderRadius: [4, 4, 0, 0] },
          },
          index === 0 ? valueMarks : []
        )
      ),
    }
  }
  const horizontal = resolveBarOrientation(draft, String(metric ?? category)) === 'horizontal'
  const valueMarks =
    chartRows?.length && y
      ? buildRefLines(chartRows, y, horizontal ? 'xAxis' : 'yAxis', refLines, language)
      : []
  if (horizontal) {
    return {
      legend: draft.legend,
      grid: { left: 8, right: 72, top: 36, bottom: 16, containLabel: true },
      maunaBarOrientation: 'horizontal',
      xAxis: {
        type: 'value',
        axisLabel: { color: '#64748b', fontSize: 10 },
        axisTick: { show: false },
        splitLine: { lineStyle: { color: '#e2e8f0', width: 1 } },
      },
      yAxis: {
        type: 'category',
        axisLabel: { color: '#0f172a', fontSize: 11, hideOverlap: true },
        axisTick: { show: false },
        axisLine: { lineStyle: { color: '#cbd5e1' } },
      },
      tooltip: { ...axisTooltip, axisPointer: { type: 'shadow' } },
      series: [
        attachRefLines(
          {
            name: metric,
            type: 'bar',
            encode: { y: category, x: metric },
            barMaxWidth: 18,
            itemStyle: { borderRadius: [0, 4, 4, 0] },
          },
          valueMarks
        ),
      ],
    }
  }
  const rotate = categoryLabels.some((label) => label.length > 6) ? 30 : 0
  return {
    legend: draft.legend,
    grid: { left: 48, right: 24, top: 36, bottom: rotate ? 56 : 28, containLabel: true },
    maunaBarOrientation: 'vertical',
    xAxis: {
      type: 'category',
      axisLabel: { color: '#0f172a', fontSize: 11, hideOverlap: true, rotate },
      axisTick: { show: false },
      axisLine: { lineStyle: { color: '#cbd5e1' } },
    },
    yAxis: {
      type: 'value',
      axisLabel: { color: '#64748b', fontSize: 10 },
      axisTick: { show: false },
      splitLine: { lineStyle: { color: '#e2e8f0', width: 1 } },
    },
    tooltip: { ...axisTooltip, axisPointer: { type: 'shadow' } },
    series: [
      attachRefLines(
        {
          name: metric,
          type: 'bar',
          encode: { x: category, y: metric },
          barMaxWidth: 28,
          itemStyle: { borderRadius: [4, 4, 0, 0] },
        },
        valueMarks
      ),
    ],
  }
}

export const buildFallbackPresetOption = (args: {
  category: string
  values: string[]
  y: string | undefined
  type: 'line' | 'bar'
  chartRows?: Array<Record<string, unknown>>
  refLines: ChartRefLines
  language: AppLanguage
}): EchartsOption => {
  const { category, values, y, type, chartRows, refLines, language } = args
  const valueMarks =
    chartRows?.length && y ? buildRefLines(chartRows, y, 'yAxis', refLines, language) : []

  if (chartRows?.length && values.length > 1) {
    const split = splitSeriesByScale(values, chartRows)
    if (split.secondary.length > 0) {
      return {
        legend: { top: 8 },
        grid: { left: 72, right: 80, top: 44, bottom: 96 },
        xAxis: { type: 'category', axisLabel: { rotate: 40, hideOverlap: true } },
        yAxis: [
          { type: 'value' },
          {
            type: 'value',
            position: 'right',
            axisLine: { show: true },
            splitLine: { show: false },
          },
        ],
        tooltip: axisTooltip,
        series: [
          ...split.primary.map((col, index) =>
            attachRefLines(
              { name: col, type, encode: { x: category, y: col } },
              index === 0 ? valueMarks : []
            )
          ),
          ...split.secondary.map((col) => ({
            name: col,
            type,
            yAxisIndex: 1,
            encode: { x: category, y: col },
          })),
        ],
      }
    }
  }

  return {
    legend: { top: 8 },
    grid: { left: 72, right: 72, top: 44, bottom: 96 },
    xAxis: { type: 'category', axisLabel: { rotate: 40, hideOverlap: true } },
    yAxis: { type: 'value', name: values[0] ?? y },
    tooltip: axisTooltip,
    series: values.map((value, index) =>
      attachRefLines(
        {
          name: value,
          type,
          encode: { x: category, y: value },
        },
        index === 0 ? valueMarks : []
      )
    ),
  }
}

export const buildPresetChartOption = (args: {
  chartType: PremiumChartPreset
  category: string
  values: string[]
  rows?: Array<Record<string, unknown>>
  refLines?: ChartRefLines
  language?: AppLanguage
}): EchartsOption => {
  const { chartType, category, values, rows } = args
  const refLines = args.refLines ?? 'none'
  const language = args.language ?? 'fr'
  const y = values[0]
  const y2 = values[1]
  if (chartType === PREMIUM_CHART_PRESET.HEATMAP) {
    return buildEchartsHeatmapOption({
      rows: rows ?? [],
      xCol: category || 'x',
      yCol: values[0] && values[0] !== (category || 'x') ? values[0] : 'y',
      valueCol: values.find((col) => col !== category && col !== values[0]) ?? values[1] ?? 'r',
      language,
    })
  }
  if (chartType === PREMIUM_CHART_PRESET.SCATTER && y && y2) {
    return buildScatterPresetOption({ category, y, y2, rows, refLines, language })
  }
  if (
    chartType === PREMIUM_CHART_PRESET.RADAR &&
    values.length >= PREMIUM_RADAR_MIN_METRICS &&
    rows?.length
  ) {
    return buildRadarPresetOption({ category, values, rows, language })
  }
  if (chartType === PREMIUM_CHART_PRESET.DONUT) {
    return buildDonutPresetOption(category, y)
  }
  if (chartType === PREMIUM_CHART_PRESET.BAR_LINE && y && y2) {
    return buildBarLinePresetOption({ category, y, y2, rows, refLines, language })
  }
  const type = chartType === PREMIUM_CHART_PRESET.LINE ? 'line' : 'bar'
  if (type === 'line' && rows?.length && y) {
    const dateLine = buildDateLinePresetOption({
      category,
      values,
      y,
      rows,
      refLines,
      language,
    })
    if (dateLine) return dateLine
  }

  const chartRows =
    type === 'bar' && rows?.length ? aggregateRowsByCategory(rows, category, values) : rows
  if (type === 'bar') {
    return buildBarPresetOption({
      category,
      values,
      y,
      chartRows,
      refLines,
      language,
    })
  }

  return buildFallbackPresetOption({
    category,
    values,
    y,
    type,
    chartRows,
    refLines,
    language,
  })
}

