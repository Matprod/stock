import type { PremiumReportBlock, PremiumReportDocument } from '#contracts/premium_report'
import {
  asEchartsOption,
  isHollowMultiMetricChart,
  sanitizeChartOptionForPrint,
} from '#services/premium_report/chart_presets'
import type { SubjectiveChartScale } from '#services/premium_report/charts/echarts_options'
import {
  expandCrowdedBarChart,
  expandCrowdedLineChart,
} from '#services/report_v4/club_html_report'
import {
  REPORT_V4_FAKE_TILE_TITLE,
  REPORT_V4_KPI_TILE_TEXT_RE,
  REPORT_V4_MONITORING_COMMENT_RE,
} from '#services/report_v4/report_v4_constants'
import {
  isFakeUnavailableDataNote,
  isGenericPositionGapNote,
} from '#services/report_v4/position_catalog'

const tableRowHasData = (row: unknown[]): boolean =>
  row.some((cell) => {
    if (cell == null) return false
    if (typeof cell === 'number') return Number.isFinite(cell)
    const text = String(cell).trim()
    return text !== '' && text !== '—' && text !== '-'
  })

export const prepareReportV4Document = (
  document: PremiumReportDocument,
  _language: 'fr' | 'en',
  heatScales?: SubjectiveChartScale[]
): PremiumReportDocument => {
  const blocks: PremiumReportBlock[] = []
  let skipNextDataProfileBody = false
  for (const block of document.blocks) {
    if (block.id === 'data_profile_heading' || block.id === 'data_profile_body') continue
    if (
      block.type === 'heading' &&
      /^(ce que les donn[eé]es permettent|what the data allows)$/i.test(block.text.trim())
    ) {
      skipNextDataProfileBody = true
      continue
    }
    if (skipNextDataProfileBody && block.type === 'text') {
      skipNextDataProfileBody = false
      continue
    }
    skipNextDataProfileBody = false
    if (block.type === 'heading' && REPORT_V4_FAKE_TILE_TITLE.test(block.text.trim())) continue
    if (
      (block.type === 'heading' || block.type === 'text') &&
      (isGenericPositionGapNote(block.text) || isFakeUnavailableDataNote(block.text))
    ) {
      continue
    }
    if (block.type === 'text') {
      const trimmed = block.text.trim()
      if (
        !trimmed ||
        REPORT_V4_KPI_TILE_TEXT_RE.test(trimmed) ||
        REPORT_V4_MONITORING_COMMENT_RE.test(trimmed)
      ) {
        continue
      }
      if (isGenericPositionGapNote(trimmed) || isFakeUnavailableDataNote(trimmed)) continue
      blocks.push(block)
      continue
    }
    if (block.type === 'chart') {
      if (
        block.option &&
        isHollowMultiMetricChart(block.title ?? '', asEchartsOption(block.option))
      ) {
        continue
      }
      const expanded = expandCrowdedLineChart(block).flatMap((piece) =>
        expandCrowdedBarChart(piece)
      )
      for (const piece of expanded) {
        if (piece.type === 'chart' && piece.option) {
          blocks.push({
            ...piece,
            option: sanitizeChartOptionForPrint(
              asEchartsOption(piece.option),
              piece.title,
              heatScales
            ),
          })
          continue
        }
        blocks.push(piece)
      }
      continue
    }
    if (block.type !== 'table') {
      blocks.push(block)
      continue
    }
    if (REPORT_V4_FAKE_TILE_TITLE.test((block.title ?? '').trim())) continue
    const rows = block.rows.filter(tableRowHasData)
    if (rows.length === 0 || block.columns.length === 0) continue
    blocks.push({ ...block, rows })
  }
  return { ...document, blocks }
}
