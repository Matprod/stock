import { escapeHtml } from '#services/report_v4/staff_render/html'
import { STAFF_COLORS, STAFF_FONTS, STAFF_TYPE_SCALE_PX } from '#services/report_v4/staff_render/tokens'

export type NotProducedBlockProps = {
  title: string
  reason?: string | null
}

export const renderNotProducedBlock = (
  props: NotProducedBlockProps,
  language: 'fr' | 'en' = 'fr'
): string => {
  const title = props.title?.trim() ?? ''
  if (!title) {
    return `<div class="staff-not-produced" data-component="NotProducedBlock" data-empty="true"></div>`
  }
  const fallback =
    language === 'fr'
      ? 'Graphique non produit — données insuffisantes pour un tracé fiable.'
      : 'Chart not produced — not enough data for a reliable plot.'
  const reason = props.reason?.trim() || fallback
  return `<div class="staff-not-produced" data-component="NotProducedBlock" style="padding:18px 16px;border:1.5px dashed ${STAFF_COLORS.line};background:${STAFF_COLORS.paper};text-align:center">
  <div style="font-family:${STAFF_FONTS.display};font-size:${STAFF_TYPE_SCALE_PX.caption}px;letter-spacing:.05em;text-transform:uppercase;color:${STAFF_COLORS.inkSoft}">${escapeHtml(title)}</div>
  <p style="margin:8px 0 0;font-size:${STAFF_TYPE_SCALE_PX.body}px;color:${STAFF_COLORS.muted}">${escapeHtml(reason)}</p>
</div>`
}
