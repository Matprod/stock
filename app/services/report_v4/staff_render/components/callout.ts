import { escapeHtml } from '#services/report_v4/staff_render/html'
import { STAFF_COLORS, STAFF_FONTS, STAFF_TYPE_SCALE_PX } from '#services/report_v4/staff_render/tokens'

export type CalloutKind = 'data_show' | 'staff_leads' | 'verify'

export type CalloutProps = {
  kind: CalloutKind
  title?: string | null
  body: string
}

const DEFAULT_TITLE: Record<CalloutKind, { fr: string; en: string }> = {
  data_show: { fr: 'Ce que les données montrent', en: 'What the data shows' },
  staff_leads: { fr: 'Pistes pour le staff', en: 'Staff leads' },
  verify: { fr: 'À vérifier', en: 'To verify' },
}

export const renderCallout = (
  props: CalloutProps,
  language: 'fr' | 'en' = 'fr'
): string => {
  const body = props.body?.trim() ?? ''
  if (!body) {
    return `<aside class="staff-callout" data-component="Callout" data-kind="${props.kind}" data-empty="true"></aside>`
  }
  const title = props.title?.trim() || DEFAULT_TITLE[props.kind][language]
  let border = STAFF_COLORS.line
  if (props.kind === 'verify') border = STAFF_COLORS.accent
  if (props.kind === 'staff_leads') border = STAFF_COLORS.series.performance
  return `<aside class="staff-callout" data-component="Callout" data-kind="${props.kind}" style="padding:12px 14px;background:${STAFF_COLORS.blockBg};border-left:3px solid ${border}">
  <div style="font-family:${STAFF_FONTS.display};font-size:${STAFF_TYPE_SCALE_PX.caption}px;letter-spacing:.05em;text-transform:uppercase;color:${STAFF_COLORS.inkSoft}">${escapeHtml(title)}</div>
  <p style="margin:6px 0 0;font-size:${STAFF_TYPE_SCALE_PX.body}px;line-height:1.45;color:${STAFF_COLORS.ink}">${escapeHtml(body)}</p>
</aside>`
}
