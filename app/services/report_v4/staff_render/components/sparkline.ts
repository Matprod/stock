import { STAFF_COLORS } from '#services/report_v4/staff_render/tokens'
import { linearScale } from '#services/report_v4/staff_render/svg_scale'

export type SparklineProps = {
  values: number[]
  color?: string
  width?: number
  height?: number
}

export const renderSparkline = (props: SparklineProps): string => {
  const values = (props.values ?? []).filter((n) => Number.isFinite(n))
  const width = props.width ?? 72
  const height = props.height ?? 22
  const color = props.color ?? STAFF_COLORS.series.risk
  if (values.length === 0) {
    return `<svg class="staff-sparkline" data-component="Sparkline" data-empty="true" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" aria-hidden="true"></svg>`
  }
  const min = Math.min(...values)
  const max = Math.max(...values)
  const x = linearScale([0, Math.max(values.length - 1, 1)], [1, width - 1])
  const y = linearScale([min === max ? min - 1 : min, min === max ? max + 1 : max], [height - 2, 2])
  const points = values.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ')
  return `<svg class="staff-sparkline" data-component="Sparkline" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" aria-hidden="true"><polyline fill="none" stroke="${color}" stroke-width="1.5" points="${points}"/></svg>`
}
