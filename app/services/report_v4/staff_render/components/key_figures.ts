import { escapeHtml } from '#services/report_v4/staff_render/html'
import { STAFF_COLORS, STAFF_FONTS, STAFF_TYPE_SCALE_PX } from '#services/report_v4/staff_render/tokens'

export type KeyFigure = {
  label: string
  value: string
  unit?: string | null
}

export type KeyFiguresProps = {
  figures: KeyFigure[]
}

export const renderKeyFigures = (props: KeyFiguresProps): string => {
  const figures = (props.figures ?? []).filter((row) => row.label?.trim() && row.value?.trim()).slice(0, 4)
  if (figures.length === 0) {
    return `<div class="staff-key-figures" data-component="KeyFigures" data-empty="true"></div>`
  }
  const cells = figures
    .map(
      (row) => `<div class="staff-kpi" style="flex:1;min-width:0;padding:10px 12px;background:${STAFF_COLORS.blockBg};border:1px solid ${STAFF_COLORS.lineSoft}">
  <div style="font-size:${STAFF_TYPE_SCALE_PX.caption}px;color:${STAFF_COLORS.muted};text-transform:uppercase;letter-spacing:.04em">${escapeHtml(row.label)}</div>
  <div style="margin-top:4px;font-family:${STAFF_FONTS.display};font-size:${STAFF_TYPE_SCALE_PX.kpi}px;font-weight:700;line-height:1;font-variant-numeric:tabular-nums;color:${STAFF_COLORS.ink}">${escapeHtml(row.value)}${row.unit ? `<span style="font-size:${STAFF_TYPE_SCALE_PX.caption}px;margin-left:4px;color:${STAFF_COLORS.inkSoft}">${escapeHtml(row.unit)}</span>` : ''}</div>
</div>`
    )
    .join('')
  return `<div class="staff-key-figures" data-component="KeyFigures" style="display:flex;gap:10px">${cells}</div>`
}
