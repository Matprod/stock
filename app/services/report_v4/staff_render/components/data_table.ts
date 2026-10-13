import { escapeHtml } from '#services/report_v4/staff_render/html'
import { formatStaffNumber } from '#services/report_v4/staff_render/format'
import { STAFF_COLORS, STAFF_FONTS, STAFF_TYPE_SCALE_PX } from '#services/report_v4/staff_render/tokens'
import { mean } from '#services/report_v4/staff_render/svg_scale'

export type DataTableColumn = {
  key: string
  label: string
  align?: 'left' | 'right'
  numeric?: boolean
}

export type DataTableProps = {
  title?: string | null
  columns: DataTableColumn[]
  rows: Array<Record<string, string | number | null | undefined>>
  showMeanRow?: boolean
  meanLabel?: string
}

export const renderDataTable = (props: DataTableProps): string => {
  const columns = (props.columns ?? []).filter((c) => c.key && c.label)
  const rows = props.rows ?? []
  if (columns.length === 0 || rows.length === 0) {
    return `<figure class="staff-data-table" data-component="DataTable" data-empty="true"></figure>`
  }
  const title = props.title?.trim() ?? ''
  const head = columns
    .map((col) => {
      const align = col.align ?? (col.numeric ? 'right' : 'left')
      return `<th style="text-align:${align};padding:6px 8px;border-bottom:1px solid ${STAFF_COLORS.line};font-size:10px;color:${STAFF_COLORS.muted};font-weight:600">${escapeHtml(col.label)}</th>`
    })
    .join('')

  const body = rows
    .map((row) => {
      const cells = columns
        .map((col) => {
          const raw = row[col.key]
          const align = col.align ?? (col.numeric ? 'right' : 'left')
          let text = '—'
          if (typeof raw === 'number' && Number.isFinite(raw)) {
            text = formatStaffNumber(raw, {
              maximumFractionDigits: Number.isInteger(raw) ? 0 : 1,
            })
          } else if (typeof raw === 'string' && raw.trim()) {
            text = raw.trim()
          }
          return `<td style="text-align:${align};padding:6px 8px;border-bottom:1px solid ${STAFF_COLORS.lineSoft};font-variant-numeric:tabular-nums;font-size:11px;color:${STAFF_COLORS.ink}">${escapeHtml(text)}</td>`
        })
        .join('')
      return `<tr>${cells}</tr>`
    })
    .join('')

  let meanRow = ''
  if (props.showMeanRow) {
    const cells = columns
      .map((col, index) => {
        if (index === 0) {
          return `<td style="padding:6px 8px;font-weight:700;font-size:11px">${escapeHtml(props.meanLabel ?? 'Moyenne')}</td>`
        }
        if (!col.numeric) {
          return `<td style="padding:6px 8px">—</td>`
        }
        const nums = rows
          .map((row) => row[col.key])
          .filter((v): v is number => typeof v === 'number' && Number.isFinite(v))
        const m = mean(nums)
        return `<td style="text-align:right;padding:6px 8px;font-weight:700;font-variant-numeric:tabular-nums;font-size:11px">${
          m === null ? '—' : formatStaffNumber(m, { maximumFractionDigits: 1 })
        }</td>`
      })
      .join('')
    meanRow = `<tr style="background:${STAFF_COLORS.blockBg}">${cells}</tr>`
  }

  return `<figure class="staff-data-table" data-component="DataTable" style="margin:0">
  ${title ? `<figcaption style="margin:0 0 6px;font-family:${STAFF_FONTS.display};font-size:${STAFF_TYPE_SCALE_PX.caption}px;letter-spacing:.04em;text-transform:uppercase;color:${STAFF_COLORS.inkSoft}">${escapeHtml(title)}</figcaption>` : ''}
  <table style="width:100%;border-collapse:collapse"><thead><tr>${head}</tr></thead><tbody>${body}${meanRow}</tbody></table>
</figure>`
}
