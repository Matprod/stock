import { escapeHtml } from '#services/report_v4/staff_render/html'
import { STAFF_COLORS, STAFF_FONTS, STAFF_TYPE_SCALE_PX } from '#services/report_v4/staff_render/tokens'
import { linearScale } from '#services/report_v4/staff_render/svg_scale'

export type LineChartSeries = {
  id: string
  label: string
  kind: 'risk' | 'performance'
  values: Array<number | null>
}

export type LineChartAnnotation =
  | { type: 'vline'; index: number; label?: string }
  | { type: 'brace'; fromIndex: number; toIndex: number; label?: string }

export type LineChartProps = {
  title?: string | null
  categories: string[]
  series: LineChartSeries[]
  yMin?: number
  yMax?: number
  sessionIndexes?: number[]
  annotations?: LineChartAnnotation[]
  width?: number
  height?: number
}

const seriesColor = (kind: 'risk' | 'performance'): string =>
  kind === 'risk' ? STAFF_COLORS.series.risk : STAFF_COLORS.series.performance

export const renderLineChart = (props: LineChartProps): string => {
  const categories = props.categories ?? []
  const series = (props.series ?? []).filter((row) => row.values?.length)
  const width = props.width ?? 698
  const height = props.height ?? 220
  const title = props.title?.trim() ?? ''
  if (categories.length === 0 || series.length === 0) {
    return `<figure class="staff-line-chart" data-component="LineChart" data-empty="true">${title ? `<figcaption>${escapeHtml(title)}</figcaption>` : ''}</figure>`
  }

  const pad = { l: 36, r: 88, t: 18, b: 28 }
  const yMin = props.yMin ?? 0
  const yMax = props.yMax ?? 100
  const x = linearScale([0, Math.max(categories.length - 1, 1)], [pad.l, width - pad.r])
  const y = linearScale([yMin, yMax], [height - pad.b, pad.t])
  const sessionSet = new Set(props.sessionIndexes ?? [])

  const grid: string[] = []
  for (const tick of [0, 25, 50, 75, 100]) {
    if (tick < yMin || tick > yMax) continue
    const yy = y(tick)
    grid.push(
      `<line x1="${pad.l}" x2="${width - pad.r}" y1="${yy.toFixed(1)}" y2="${yy.toFixed(1)}" stroke="${STAFF_COLORS.lineSoft}" stroke-width="1"/>` +
        `<text x="${pad.l - 6}" y="${(yy + 3).toFixed(1)}" text-anchor="end" font-size="9" fill="${STAFF_COLORS.muted}" font-family="${STAFF_FONTS.body}">${tick}</text>`
    )
  }

  const cats = categories
    .map((label, i) => {
      const xx = x(i)
      return `<text x="${xx.toFixed(1)}" y="${height - 8}" text-anchor="middle" font-size="9" fill="${STAFF_COLORS.muted}" font-family="${STAFF_FONTS.body}">${escapeHtml(label)}</text>${
        sessionSet.has(i)
          ? `<line x1="${xx.toFixed(1)}" x2="${xx.toFixed(1)}" y1="${pad.t}" y2="${height - pad.b}" stroke="${STAFF_COLORS.line}" stroke-dasharray="2 3"/>`
          : ''
      }`
    })
    .join('')

  const paths = series
    .map((row) => {
      const color = seriesColor(row.kind)
      const pts = row.values
        .map((v, i) => (v === null || !Number.isFinite(v) ? null : { i, v }))
        .filter((p): p is { i: number; v: number } => p !== null)
      if (pts.length === 0) return ''
      const d = pts
        .map((p, idx) => `${idx === 0 ? 'M' : 'L'}${x(p.i).toFixed(1)},${y(p.v).toFixed(1)}`)
        .join(' ')
      const markers = pts
        .map((p) => {
          const cx = x(p.i)
          const cy = y(p.v)
          if (row.kind === 'risk') {
            return `<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="3.2" fill="${color}"/>`
          }
          return `<rect x="${(cx - 3).toFixed(1)}" y="${(cy - 3).toFixed(1)}" width="6" height="6" fill="${color}"/>`
        })
        .join('')
      const last = pts[pts.length - 1]!
      const endLabel = `<text x="${(x(last.i) + 8).toFixed(1)}" y="${(y(last.v) + 3).toFixed(1)}" font-size="10" font-family="${STAFF_FONTS.body}" fill="${STAFF_COLORS.inkSoft}">${escapeHtml(row.label)}</text>`
      return `<path d="${d}" fill="none" stroke="${color}" stroke-width="1.8"/>${markers}${endLabel}`
    })
    .join('')

  const annotations = (props.annotations ?? [])
    .map((ann) => {
      if (ann.type === 'vline') {
        const xx = x(ann.index)
        return `<line x1="${xx.toFixed(1)}" x2="${xx.toFixed(1)}" y1="${pad.t}" y2="${height - pad.b}" stroke="${STAFF_COLORS.accent}" stroke-width="1"/>${
          ann.label
            ? `<text x="${(xx + 4).toFixed(1)}" y="${pad.t + 10}" font-size="9" fill="${STAFF_COLORS.accent}">${escapeHtml(ann.label)}</text>`
            : ''
        }`
      }
      const x1 = x(ann.fromIndex)
      const x2 = x(ann.toIndex)
      const yy = pad.t + 4
      return `<path d="M${x1.toFixed(1)},${yy + 8} V${yy} H${x2.toFixed(1)} V${yy + 8}" fill="none" stroke="${STAFF_COLORS.accent}" stroke-width="1"/>${
        ann.label
          ? `<text x="${((x1 + x2) / 2).toFixed(1)}" y="${yy - 2}" text-anchor="middle" font-size="9" fill="${STAFF_COLORS.accent}">${escapeHtml(ann.label)}</text>`
          : ''
      }`
    })
    .join('')

  return `<figure class="staff-line-chart" data-component="LineChart" style="margin:0">
  ${title ? `<figcaption style="margin:0 0 6px;font-family:${STAFF_FONTS.display};font-size:${STAFF_TYPE_SCALE_PX.caption}px;letter-spacing:.04em;text-transform:uppercase;color:${STAFF_COLORS.inkSoft}">${escapeHtml(title)}</figcaption>` : ''}
  <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeHtml(title || 'line chart')}">${grid.join('')}${cats}${annotations}${paths}</svg>
</figure>`
}
