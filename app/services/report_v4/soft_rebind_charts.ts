import logger from '@adonisjs/core/services/logger'
import type { PremiumReportDocument } from '#contracts/premium_report'
import type { StaffHeatScale } from '#services/premium_report/premium_report_document'
import { collectArtifactCharts } from '#services/report_v4/artifact_html'

export const restoreSoftProseChartsFromPrior = (args: {
  document: PremiumReportDocument
  priorDocument: PremiumReportDocument
  heatScales: StaffHeatScale[]
}): { document: PremiumReportDocument; chartCount: number } => {
  const priorCharts = new Map(
    args.priorDocument.blocks
      .filter((block) => block.type === 'chart')
      .map((block) => [block.id, block])
  )
  const document = args.document
  document.blocks = document.blocks.map((block) => {
    if (block.type !== 'chart') return block
    return priorCharts.get(block.id) ?? block
  })
  const charts = collectArtifactCharts(document, args.heatScales)
  const chartCount = charts.length
  logger.info({ charts: chartCount }, 'report_v4.soft_prose_charts_restored_from_prior')
  return { document, chartCount }
}

export const restoreDroppedChartsFromPrior = (args: {
  document: PremiumReportDocument
  priorDocument: PremiumReportDocument
  priorChartCount: number
  chartCount: number
  heatScales: StaffHeatScale[]
}): { document: PremiumReportDocument; chartCount: number } => {
  logger.warn(
    { charts: args.chartCount, priorCharts: args.priorChartCount },
    'report_v4.soft_rebind_chart_drop_restored'
  )
  const document = args.document
  const currentIds = new Set(document.blocks.filter((b) => b.type === 'chart').map((b) => b.id))
  const missing = args.priorDocument.blocks
    .map((block, index) => ({ block, index }))
    .filter(({ block }) => block.type === 'chart' && !currentIds.has(block.id))
  for (const row of missing) {
    let insertAt = document.blocks.length
    for (let i = row.index - 1; i >= 0; i -= 1) {
      const prevId = args.priorDocument.blocks[i]?.id
      if (!prevId) continue
      const curIdx = document.blocks.findIndex((b) => b.id === prevId)
      if (curIdx >= 0) {
        insertAt = curIdx + 1
        break
      }
      if (i === 0) insertAt = 0
    }
    if (row.index === 0) insertAt = 0
    document.blocks.splice(insertAt, 0, row.block)
  }
  const charts = collectArtifactCharts(document, args.heatScales)
  return { document, chartCount: charts.length }
}
