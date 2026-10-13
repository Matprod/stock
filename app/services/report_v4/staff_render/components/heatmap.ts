import { escapeHtml } from '#services/report_v4/staff_render/html'
import { formatStaffNumber } from '#services/report_v4/staff_render/format'
import {
  STAFF_COLORS,
  STAFF_FONTS,
  STAFF_TYPE_SCALE_PX,
  staffRiskFill,
  staffTextOnFill,
} from '#services/report_v4/staff_render/tokens'
import { mean } from '#services/report_v4/staff_render/svg_scale'

export type HeatmapRow = {
  label: string
  values: Array<number | null>
}

export type HeatmapProps = {
  title?: string | null
  days: string[]
  rows: HeatmapRow[]
  teamValues?: Array<number | null>
  fillForValue?: (value: number) => string
}

export const renderHeatmap = (props: HeatmapProps): string => {
  const days = props.days ?? []
  const fillForValue = props.fillForValue ?? staffRiskFill
  const rows = [...(props.rows ?? [])]
    .map((row) => {
      const nums = row.values.filter((v): v is number => v !== null && Number.isFinite(v))
      return { ...row, mean: mean(nums) }
    })
    .filter((row) => row.label?.trim())
    .sort((a, b) => (b.mean ?? -Infinity) - (a.mean ?? -Infinity))

  if (days.length === 0 || rows.length === 0) {
    return `<figure class="staff-heatmap" data-component="Heatmap" data-empty="true"></figure>`
  }

  const title = props.title?.trim() ?? ''
  const cell = (value: number | null): string => {
    if (value === null || !Number.isFinite(value)) {
      return `<td style="background:${STAFF_COLORS.lineSoft};color:${STAFF_COLORS.muted};text-align:center;font-variant-numeric:tabular-nums;padding:4px 3px;font-size:10px">—</td>`
    }
    const fill = fillForValue(value)
    const text = staffTextOnFill(fill)
    return `<td style="background:${fill};color:${text};text-align:center;font-variant-numeric:tabular-nums;padding:4px 3px;font-size:10px">${formatStaffNumber(value, { maximumFractionDigits: 0 })}</td>`
  }

  const head = `<tr><th style="text-align:left;padding:4px 6px;font-size:10px;color:${STAFF_COLORS.muted}">Joueur</th>${days
    .map((d) => `<th style="padding:4px 3px;font-size:10px;color:${STAFF_COLORS.muted};font-weight:600">${escapeHtml(d)}</th>`)
    .join('')}<th style="padding:4px 3px;font-size:10px;color:${STAFF_COLORS.muted}">Moy.</th></tr>`

  const body = rows
    .map((row) => {
      const cells = days.map((_, i) => cell(row.values[i] ?? null)).join('')
      const m = row.mean
      return `<tr><th style="text-align:left;padding:4px 6px;font-size:11px;font-weight:600;color:${STAFF_COLORS.ink}">${escapeHtml(row.label)}</th>${cells}${cell(m)}</tr>`
    })
    .join('')

  const team =
    props.teamValues && props.teamValues.length
      ? `<tr style="border-top:2px solid ${STAFF_COLORS.line}"><th style="text-align:left;padding:4px 6px;font-size:11px;font-weight:700;color:${STAFF_COLORS.ink}">Équipe</th>${days
          .map((_, i) => cell(props.teamValues![i] ?? null))
          .join('')}${cell(mean(props.teamValues.filter((v): v is number => v !== null && Number.isFinite(v))))}</tr>`
      : ''

  const legend = STAFF_COLORS
  void legend
  const legendHtml = `<div style="display:flex;gap:6px;align-items:center;margin-top:8px;font-size:${STAFF_TYPE_SCALE_PX.caption}px;color:${STAFF_COLORS.muted}">
  <span>Risque</span>
  ${[0, 15, 35, 60, 80]
    .map((v) => {
      const fill = fillForValue(v)
      return `<span style="display:inline-block;width:28px;height:12px;background:${fill};border:1px solid ${STAFF_COLORS.line}"></span>`
    })
    .join('')}
</div>`

  return `<figure class="staff-heatmap" data-component="Heatmap" style="margin:0">
  ${title ? `<figcaption style="margin:0 0 6px;font-family:${STAFF_FONTS.display};font-size:${STAFF_TYPE_SCALE_PX.caption}px;letter-spacing:.04em;text-transform:uppercase;color:${STAFF_COLORS.inkSoft}">${escapeHtml(title)}</figcaption>` : ''}
  <table style="width:100%;border-collapse:collapse">${head}${body}${team}</table>
  ${legendHtml}
</figure>`
}
