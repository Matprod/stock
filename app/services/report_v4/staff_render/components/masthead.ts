import { escapeHtml } from '#services/report_v4/staff_render/html'
import { STAFF_COLORS, STAFF_FONTS, STAFF_TYPE_SCALE_PX } from '#services/report_v4/staff_render/tokens'

export type MastheadProps = {
  eyebrow?: string | null
  title: string
  subtitle?: string | null
}

export const renderMasthead = (props: MastheadProps): string => {
  const title = props.title?.trim() ?? ''
  if (!title) {
    return `<header class="staff-masthead" data-component="Masthead" data-empty="true"></header>`
  }
  const eyebrow = props.eyebrow?.trim() ?? ''
  const subtitle = props.subtitle?.trim() ?? ''
  return `<header class="staff-masthead" data-component="Masthead">
  ${eyebrow ? `<div class="staff-masthead-eyebrow" style="font-family:${STAFF_FONTS.display};font-size:${STAFF_TYPE_SCALE_PX.caption}px;letter-spacing:.08em;text-transform:uppercase;color:${STAFF_COLORS.accent}">${escapeHtml(eyebrow)}</div>` : ''}
  <h1 class="staff-masthead-title" style="margin:6px 0 0;font-family:${STAFF_FONTS.display};font-size:${STAFF_TYPE_SCALE_PX.display}px;line-height:1.15;font-weight:700;color:${STAFF_COLORS.ink}">${escapeHtml(title)}</h1>
  ${subtitle ? `<p class="staff-masthead-sub" style="margin:8px 0 0;font-size:${STAFF_TYPE_SCALE_PX.subtitle}px;color:${STAFF_COLORS.inkSoft}">${escapeHtml(subtitle)}</p>` : ''}
</header>`
}
