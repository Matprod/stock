import { escapeHtml } from '#services/report_v4/staff_render/html'
import { STAFF_COLORS, STAFF_FONTS, STAFF_TYPE_SCALE_PX } from '#services/report_v4/staff_render/tokens'

export type FindingItem = {
  text: string
}

export type FindingsProps = {
  items: FindingItem[]
}

export const renderFindings = (props: FindingsProps): string => {
  const items = (props.items ?? []).filter((row) => row.text?.trim()).slice(0, 3)
  if (items.length === 0) {
    return `<ol class="staff-findings" data-component="Findings" data-empty="true"></ol>`
  }
  const rows = items
    .map(
      (item, index) => `<li class="staff-finding" style="display:flex;gap:10px;margin:0 0 8px;padding:0">
  <span style="flex:0 0 22px;font-family:${STAFF_FONTS.display};font-weight:700;color:${STAFF_COLORS.accent}">${index + 1}</span>
  <span style="flex:1;color:${STAFF_COLORS.ink};font-size:${STAFF_TYPE_SCALE_PX.body}px;line-height:1.4">${escapeHtml(item.text.trim())}</span>
</li>`
    )
    .join('')
  return `<ol class="staff-findings" data-component="Findings" style="list-style:none;margin:0;padding:0">${rows}</ol>`
}
