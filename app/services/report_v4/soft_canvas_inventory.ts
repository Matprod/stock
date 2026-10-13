import { PREMIUM_BLOCK_TYPE } from '#constants/premium_report.constants'
import { asEchartsOption, chartTypeFromOption } from '#services/premium_report/chart_presets'
import { asSeriesList } from '#services/premium_report/charts/echarts_types'
import {
  buildSoftArtifactOutline,
  tocPresentInHtml,
} from '#services/report_v4/artifact_sections'

export type SoftCanvasBlockIndex = {
  id: string
  type: string
  title: string
  seriesNames?: string[]
  chartType?: string
}

export type SoftCanvasInventory = {
  sectionTitles: string[]
  charts: SoftCanvasBlockIndex[]
  tables: SoftCanvasBlockIndex[]
  headings: string[]
  blockCount: number
  chartCount: number
  tableCount: number
  hasToc: boolean
  outline: Array<{ id: string; bandTitle: string; chartHostIds: string[] }>
}

type SoftInventoryBlock = {
  id: string
  type: string
  title?: string | null
  text?: string | null
  option?: Record<string, unknown> | unknown
}

const blockTitle = (block: SoftInventoryBlock): string => {
  if (block.type === PREMIUM_BLOCK_TYPE.CHART || block.type === PREMIUM_BLOCK_TYPE.TABLE) {
    return (block.title ?? '').trim()
  }
  if (block.type === PREMIUM_BLOCK_TYPE.HEADING) return (block.text ?? '').trim()
  return typeof block.text === 'string' ? block.text.trim().slice(0, 80) : ''
}

export const buildSoftCanvasInventory = (args: {
  document?: { blocks?: SoftInventoryBlock[] | null } | null
  html?: string | null
}): SoftCanvasInventory => {
  const blocks = args.document?.blocks ?? []
  const html = typeof args.html === 'string' ? args.html : ''
  const outline = html ? buildSoftArtifactOutline(html) : []
  const sectionTitles = [
    ...new Set(
      [
        ...outline.map((row) => row.bandTitle.trim()).filter(Boolean),
        ...blocks
          .filter((b) => b.type === PREMIUM_BLOCK_TYPE.HEADING)
          .map((b) => blockTitle(b))
          .filter(Boolean),
      ].filter(Boolean)
    ),
  ]

  const charts: SoftCanvasBlockIndex[] = []
  const tables: SoftCanvasBlockIndex[] = []
  const headings: string[] = []

  for (const block of blocks) {
    const title = blockTitle(block)
    if (block.type === PREMIUM_BLOCK_TYPE.CHART) {
      const option = asEchartsOption(
        block.option && typeof block.option === 'object' && !Array.isArray(block.option)
          ? (block.option as Record<string, unknown>)
          : {}
      )
      const seriesNames = asSeriesList(option.series)
        .map((entry) => (typeof entry.name === 'string' ? entry.name.trim() : ''))
        .filter(Boolean)
        .slice(0, 12)
      charts.push({
        id: block.id,
        type: 'chart',
        title,
        chartType: chartTypeFromOption(option) ?? undefined,
        seriesNames: seriesNames.length ? seriesNames : undefined,
      })
      continue
    }
    if (block.type === PREMIUM_BLOCK_TYPE.TABLE) {
      tables.push({ id: block.id, type: 'table', title })
      continue
    }
    if (block.type === PREMIUM_BLOCK_TYPE.HEADING && title) headings.push(title)
  }

  return {
    sectionTitles: sectionTitles.slice(0, 40),
    charts: charts.slice(0, 40),
    tables: tables.slice(0, 20),
    headings: headings.slice(0, 30),
    blockCount: blocks.length,
    chartCount: charts.length,
    tableCount: tables.length,
    hasToc: html ? tocPresentInHtml(html) : false,
    outline: outline.slice(0, 40),
  }
}

export const compactSoftCanvasInventoryForRouter = (
  inventory: SoftCanvasInventory
): Record<string, unknown> => ({
  hasToc: inventory.hasToc,
  blockCount: inventory.blockCount,
  chartCount: inventory.chartCount,
  tableCount: inventory.tableCount,
  sectionTitles: inventory.sectionTitles.slice(0, 24),
  chartTitles: inventory.charts.map((c) => ({ id: c.id, title: c.title, type: c.chartType })),
  tableTitles: inventory.tables.map((t) => ({ id: t.id, title: t.title })),
})

export const softOpsAgentPacket = (softOps: {
  editorialOnly: boolean
  needsAnalyst: boolean
  needsFetch: boolean
  removeQueries: string[]
  ensureToc: boolean
  hasDataOps: boolean
  restoreSheets: boolean
  addSectionProse: boolean
  additiveSoft: boolean
  layoutRepair: boolean
  wantsTeamMean: boolean
  enrichExistingCharts: boolean
  ops: Array<{ type: string }>
}) => ({
  ...softOps,
  ops: softOps.ops.map((op) => op.type),
})
