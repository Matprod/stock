import { escapeHtml } from '#services/report_v4/staff_render/html'
import { STAFF_COLORS, STAFF_FONTS, STAFF_TYPE_SCALE_PX } from '#services/report_v4/staff_render/tokens'

export type CoverageStatus = 'complete' | 'partial' | 'limited'

export type CoverageRow = {
  domain: string
  status: CoverageStatus
  source?: string | null
  available?: string | null
  missing?: string | null
}

export type CoverageTableProps = {
  title?: string | null
  rows: CoverageRow[]
}

const STATUS_COPY: Record<
  CoverageStatus,
  { fr: { icon: string; label: string }; en: { icon: string; label: string }; color: string }
> = {
  complete: {
    fr: { icon: '●', label: 'complet' },
    en: { icon: '●', label: 'complete' },
    color: '#0f8f62',
  },
  partial: {
    fr: { icon: '◐', label: 'partiel' },
    en: { icon: '◐', label: 'partial' },
    color: STAFF_COLORS.series.performance,
  },
  limited: {
    fr: { icon: '○', label: 'limité' },
    en: { icon: '○', label: 'limited' },
    color: STAFF_COLORS.accent,
  },
}

export const renderCoverageTable = (
  props: CoverageTableProps,
  language: 'fr' | 'en' = 'fr'
): string => {
  const rows = (props.rows ?? []).filter((row) => row.domain?.trim())
  if (rows.length === 0) {
    return `<figure class="staff-coverage-table" data-component="CoverageTable" data-empty="true"></figure>`
  }
  const title = props.title?.trim() ?? (language === 'fr' ? 'Couverture des données' : 'Data coverage')
  const headLabels =
    language === 'fr'
      ? ['Domaine', 'Statut', 'Source', 'Disponible', 'Absent']
      : ['Domain', 'Status', 'Source', 'Available', 'Missing']
  const head = headLabels
    .map(
      (label) =>
        `<th style="text-align:left;padding:6px 8px;border-bottom:1px solid ${STAFF_COLORS.line};font-size:10px;color:${STAFF_COLORS.muted}">${escapeHtml(label)}</th>`
    )
    .join('')
  const body = rows
    .map((row) => {
      const status = STATUS_COPY[row.status]
      const copy = status[language]
      return `<tr>
  <td style="padding:6px 8px;border-bottom:1px solid ${STAFF_COLORS.lineSoft};font-size:11px">${escapeHtml(row.domain)}</td>
  <td style="padding:6px 8px;border-bottom:1px solid ${STAFF_COLORS.lineSoft};font-size:11px;color:${status.color}"><span aria-hidden="true">${copy.icon}</span> ${escapeHtml(copy.label)}</td>
  <td style="padding:6px 8px;border-bottom:1px solid ${STAFF_COLORS.lineSoft};font-size:11px;color:${STAFF_COLORS.inkSoft}">${escapeHtml(row.source?.trim() || '—')}</td>
  <td style="padding:6px 8px;border-bottom:1px solid ${STAFF_COLORS.lineSoft};font-size:11px">${escapeHtml(row.available?.trim() || '—')}</td>
  <td style="padding:6px 8px;border-bottom:1px solid ${STAFF_COLORS.lineSoft};font-size:11px;color:${STAFF_COLORS.muted}">${escapeHtml(row.missing?.trim() || '—')}</td>
</tr>`
    })
    .join('')

  return `<figure class="staff-coverage-table" data-component="CoverageTable" style="margin:0">
  <figcaption style="margin:0 0 6px;font-family:${STAFF_FONTS.display};font-size:${STAFF_TYPE_SCALE_PX.caption}px;letter-spacing:.04em;text-transform:uppercase;color:${STAFF_COLORS.inkSoft}">${escapeHtml(title)}</figcaption>
  <table style="width:100%;border-collapse:collapse"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>
</figure>`
}
