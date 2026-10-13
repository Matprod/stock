import { escapeHtml } from '#services/report_v4/staff_render/html'
import { STAFF_COLORS, STAFF_FONTS, STAFF_TYPE_SCALE_PX } from '#services/report_v4/staff_render/tokens'

export type ReferenceBlockProps = {
  title: string
  body: string
}

export const renderReferenceBlock = (
  props: ReferenceBlockProps,
  language: 'fr' | 'en' = 'fr'
): string => {
  const title = props.title?.trim() ?? ''
  const body = props.body?.trim() ?? ''
  if (!title && !body) {
    return `<aside class="staff-reference" data-component="ReferenceBlock" data-empty="true"></aside>`
  }
  const banner =
    language === 'fr'
      ? 'Référence générale, hors données du club'
      : 'General reference, outside club data'
  return `<aside class="staff-reference" data-component="ReferenceBlock" style="padding:12px 14px;border:1px solid ${STAFF_COLORS.line};background:${STAFF_COLORS.blockBg}">
  <div style="font-family:${STAFF_FONTS.display};font-size:${STAFF_TYPE_SCALE_PX.caption}px;letter-spacing:.05em;text-transform:uppercase;color:${STAFF_COLORS.accent}">${escapeHtml(banner)}</div>
  ${title ? `<div style="margin-top:6px;font-weight:700;color:${STAFF_COLORS.ink}">${escapeHtml(title)}</div>` : ''}
  ${body ? `<p style="margin:6px 0 0;font-size:${STAFF_TYPE_SCALE_PX.body}px;line-height:1.45;color:${STAFF_COLORS.inkSoft}">${escapeHtml(body)}</p>` : ''}
</aside>`
}
