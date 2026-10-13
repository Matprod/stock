import { escapeHtml } from '#services/report_v4/staff_render/html'
import { renderSparkline } from '#services/report_v4/staff_render/components/sparkline'
import { STAFF_COLORS, STAFF_FONTS, STAFF_TYPE_SCALE_PX } from '#services/report_v4/staff_render/tokens'
import type { StaffTrend } from '#services/report_v4/staff_render/svg_scale'

export type WatchCardProps = {
  name: string
  position?: string | null
  valueLabel: string
  value: string
  trend: StaffTrend
  series: number[]
  note?: string | null
  sheetHref?: string | null
}

const trendGlyph = (trend: StaffTrend): { label: string; color: string } => {
  if (trend === 'up') return { label: '↑', color: STAFF_COLORS.series.risk }
  if (trend === 'down') return { label: '↓', color: STAFF_COLORS.series.performance }
  return { label: '→', color: STAFF_COLORS.muted }
}

export const renderWatchCard = (props: WatchCardProps): string => {
  const name = props.name?.trim() ?? ''
  if (!name) {
    return `<article class="staff-watch-card" data-component="WatchCard" data-empty="true"></article>`
  }
  const trend = trendGlyph(props.trend)
  const note = props.note?.trim() ?? ''
  const href = props.sheetHref?.trim() ?? ''
  return `<article class="staff-watch-card" data-component="WatchCard" data-athlete="${escapeHtml(name)}" style="padding:12px;border:1px solid ${STAFF_COLORS.line};background:${STAFF_COLORS.paper}">
  <div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start">
    <div>
      <div style="font-family:${STAFF_FONTS.display};font-size:${STAFF_TYPE_SCALE_PX.title}px;font-weight:700;color:${STAFF_COLORS.ink}">${escapeHtml(name)}</div>
      ${props.position ? `<div style="margin-top:2px;font-size:${STAFF_TYPE_SCALE_PX.caption}px;color:${STAFF_COLORS.muted};text-transform:uppercase;letter-spacing:.04em">${escapeHtml(props.position)}</div>` : ''}
    </div>
    <div style="text-align:right">
      <div style="font-size:${STAFF_TYPE_SCALE_PX.caption}px;color:${STAFF_COLORS.muted}">${escapeHtml(props.valueLabel)}</div>
      <div style="font-family:${STAFF_FONTS.display};font-size:24px;font-weight:700;font-variant-numeric:tabular-nums;color:${STAFF_COLORS.ink}">${escapeHtml(props.value)}
        <span aria-label="trend-${props.trend}" style="margin-left:4px;color:${trend.color}">${trend.label}</span>
      </div>
    </div>
  </div>
  <div style="margin-top:8px">${renderSparkline({ values: props.series, color: STAFF_COLORS.series.risk })}</div>
  ${note ? `<p style="margin:8px 0 0;font-size:${STAFF_TYPE_SCALE_PX.body}px;color:${STAFF_COLORS.inkSoft};line-height:1.4">${escapeHtml(note)}</p>` : ''}
  ${href ? `<a href="${escapeHtml(href)}" style="display:inline-block;margin-top:8px;font-size:${STAFF_TYPE_SCALE_PX.caption}px;color:${STAFF_COLORS.accent}">→ fiche</a>` : ''}
</article>`
}
