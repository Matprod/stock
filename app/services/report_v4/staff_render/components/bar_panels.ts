import { escapeHtml } from '#services/report_v4/staff_render/html'
import { formatStaffNumber } from '#services/report_v4/staff_render/format'
import { STAFF_COLORS, STAFF_FONTS, STAFF_TYPE_SCALE_PX } from '#services/report_v4/staff_render/tokens'
import { linearScale } from '#services/report_v4/staff_render/svg_scale'

export type BarPanelItem = {
  label: string
  value: number | null
}

export type BarPanel = {
  title: string
  items: BarPanelItem[]
  unit?: string | null
}

export type BarPanelsProps = {
  panels: BarPanel[]
  barMaxWidth?: number
}

export const renderBarPanels = (props: BarPanelsProps): string => {
  const panels = (props.panels ?? []).filter((p) => p.title?.trim())
  if (panels.length === 0) {
    return `<div class="staff-bar-panels" data-component="BarPanels" data-empty="true"></div>`
  }
  const barMaxWidth = props.barMaxWidth ?? 160
  const html = panels
    .map((panel) => {
      const items = panel.items.filter((row) => row.label?.trim())
      const nums = items
        .map((row) => row.value)
        .filter((v): v is number => v !== null && Number.isFinite(v))
      const max = nums.length ? Math.max(...nums) : 0
      const scale = linearScale([0, max || 1], [0, barMaxWidth])
      const rows = items
        .map((row) => {
          const missing = row.value === null || !Number.isFinite(row.value)
          const value = missing ? 0 : row.value!
          const isMax = !missing && value === max && max > 0
          const width = missing ? 0 : scale(value)
          const fill = isMax ? STAFF_COLORS.ink : STAFF_COLORS.inkSoft
          return `<div style="display:flex;align-items:center;gap:8px;margin:3px 0">
  <div style="width:110px;flex:0 0 110px;font-size:11px;color:${STAFF_COLORS.ink};white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escapeHtml(row.label)}</div>
  <div style="flex:1;height:10px;background:${STAFF_COLORS.lineSoft}">
    <div style="width:${width.toFixed(1)}px;height:10px;background:${fill}"></div>
  </div>
  <div style="width:56px;text-align:right;font-variant-numeric:tabular-nums;font-size:11px;color:${STAFF_COLORS.ink}">${
    missing ? '—' : formatStaffNumber(value, { maximumFractionDigits: value >= 100 ? 0 : 1 })
  }</div>
</div>`
        })
        .join('')
      return `<div class="staff-bar-panel" style="flex:1;min-width:180px">
  <h3 style="margin:0 0 6px;font-family:${STAFF_FONTS.display};font-size:${STAFF_TYPE_SCALE_PX.caption}px;letter-spacing:.04em;text-transform:uppercase;color:${STAFF_COLORS.inkSoft}">${escapeHtml(panel.title)}${panel.unit ? ` (${escapeHtml(panel.unit)})` : ''}</h3>
  ${rows || `<div data-empty="true" style="color:${STAFF_COLORS.muted}">—</div>`}
</div>`
    })
    .join('')

  return `<div class="staff-bar-panels" data-component="BarPanels" style="display:flex;flex-wrap:wrap;gap:16px">${html}</div>`
}
