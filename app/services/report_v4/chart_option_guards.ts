import type { ReportDesignPack } from '#services/report_v4/design/report_design_pack'

type ChartGuardIssue = {
  code:
    | 'dual_value_axis'
    | 'bar_not_from_zero'
    | 'color_outside_pack'
    | 'forbidden_form'
  detail: string
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)

const seriesList = (option: Record<string, unknown>): Record<string, unknown>[] => {
  if (!Array.isArray(option.series)) return []
  return option.series.filter(isRecord)
}

const hasBarSeries = (option: Record<string, unknown>): boolean =>
  seriesList(option).some((row) => String(row.type ?? '') === 'bar')

const axisMin = (axis: unknown): number | null => {
  if (!isRecord(axis)) return null
  return typeof axis.min === 'number' && Number.isFinite(axis.min) ? axis.min : null
}

const collectColors = (option: Record<string, unknown>): string[] => {
  const colors: string[] = []
  if (Array.isArray(option.color)) {
    for (const row of option.color) {
      if (typeof row === 'string' && row.startsWith('#')) colors.push(row.toLowerCase())
    }
  }
  for (const series of seriesList(option)) {
    const item = isRecord(series.itemStyle) ? series.itemStyle : null
    const line = isRecord(series.lineStyle) ? series.lineStyle : null
    for (const candidate of [item?.color, line?.color]) {
      if (typeof candidate === 'string' && candidate.startsWith('#')) {
        colors.push(candidate.toLowerCase())
      }
    }
  }
  return colors
}

export const checkChartOptionGuards = (args: {
  option: Record<string, unknown>
  pack: ReportDesignPack
  chartType?: string
}): ChartGuardIssue[] => {
  const issues: ChartGuardIssue[] = []
  const chartType = (args.chartType ?? '').toLowerCase()
  if (chartType === 'donut' || chartType === 'bar-line') {
    issues.push({
      code: 'forbidden_form',
      detail: `${chartType} is not allowed in staff reports`,
    })
  }

  const yAxis = args.option.yAxis
  if (Array.isArray(yAxis) && yAxis.length > 1) {
    const valueAxes = yAxis.filter(
      (axis) => isRecord(axis) && (axis.type == null || axis.type === 'value')
    )
    if (valueAxes.length > 1) {
      issues.push({
        code: 'dual_value_axis',
        detail: `yAxis has ${valueAxes.length} value axes`,
      })
    }
  }

  if (hasBarSeries(args.option)) {
    const min = Array.isArray(yAxis)
      ? axisMin(yAxis[0])
      : axisMin(yAxis)
    if (min != null && min !== 0) {
      issues.push({
        code: 'bar_not_from_zero',
        detail: `bar yAxis.min=${min}`,
      })
    }
  }

  const allowed = new Set([
    ...args.pack.palette.map((row) => row.toLowerCase()),
    args.pack.tokens.primary.toLowerCase(),
    args.pack.tokens.cherry.toLowerCase(),
    args.pack.tokens.saffron.toLowerCase(),
    args.pack.tokens.ink.toLowerCase(),
    '#ffffff',
    '#000000',
    'transparent',
  ])
  for (const color of collectColors(args.option)) {
    if (color === 'transparent') continue
    if (!allowed.has(color)) {
      issues.push({
        code: 'color_outside_pack',
        detail: color,
      })
    }
  }

  return issues
}

const SYMBOL_BY_INDEX = [
  'circle',
  'rect',
  'triangle',
  'diamond',
  'roundRect',
  'pin',
  'arrow',
  'emptyCircle',
] as const

const isSquadRangeEdge = (row: Record<string, unknown>): boolean => {
  if (row.stack === 'squad-range') return true
  const name = String(row.name ?? '').toLowerCase()
  return name === 'min' || name === 'max' || name.endsWith(' min') || name.endsWith(' max')
}

const resolveLineDashType = (row: Record<string, unknown>): string | number[] => {
  const prevLine = isRecord(row.lineStyle) ? row.lineStyle : {}
  if (isSquadRangeEdge(row)) {
    return typeof prevLine.type === 'string' || Array.isArray(prevLine.type)
      ? (prevLine.type as string | number[])
      : 'dashed'
  }
  return 'solid'
}

/** Collapse dual value axes; force bars from zero; solid lines except squad-range edges. */
export const enforceChartOptionGuards = (
  option: Record<string, unknown>,
  pack: ReportDesignPack
): { option: Record<string, unknown>; issues: ChartGuardIssue[] } => {
  let next: Record<string, unknown> = { ...option }

  if (Array.isArray(next.yAxis) && next.yAxis.length > 1) {
    const primary = next.yAxis[0]
    next = {
      ...next,
      yAxis: isRecord(primary) ? { ...primary, type: primary.type ?? 'value' } : { type: 'value' },
      series: seriesList(next).map((row) => {
        const copy = { ...row }
        delete copy.yAxisIndex
        return copy
      }),
    }
  }

  if (hasBarSeries(next)) {
    if (Array.isArray(next.yAxis)) {
      const primary = isRecord(next.yAxis[0]) ? { ...next.yAxis[0], min: 0 } : { type: 'value', min: 0 }
      next = { ...next, yAxis: [primary, ...next.yAxis.slice(1)] }
    } else if (isRecord(next.yAxis)) {
      next = { ...next, yAxis: { ...next.yAxis, min: 0 } }
    } else {
      next = { ...next, yAxis: { type: 'value', min: 0 } }
    }
  }

  const palette = pack.palette
  next = {
    ...next,
    color: Array.isArray(next.color) && next.color.length ? next.color : [...palette],
    series: seriesList(next).map((row, index) => {
      if (String(row.type ?? '') !== 'line' && row.type != null) return row
      const prevLine = isRecord(row.lineStyle) ? row.lineStyle : {}
      return {
        ...row,
        symbol: row.symbol ?? SYMBOL_BY_INDEX[index % SYMBOL_BY_INDEX.length],
        lineStyle: {
          ...prevLine,
          type: resolveLineDashType(row),
        },
      }
    }),
  }

  return { option: next, issues: checkChartOptionGuards({ option: next, pack }) }
}
