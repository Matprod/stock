import logger from '@adonisjs/core/services/logger'
import { PREMIUM_BLOCK_TYPE } from '#constants/premium_report.constants'
import type { PremiumReportDocument, PremiumTableBlock } from '#contracts/premium_report'
import {
  dropEmptyChartBlocks,
  sanitizeIncomingDocument,
  applyTableHeat,
  shouldHeatStaffTable,
  type StaffHeatScale,
} from '#services/premium_report/premium_report_document'
import type { PremiumReportState } from '#services/premium_report/premium_report_tools'
import type { PremiumReportTokenUsage } from '#services/premium_report/premium_report_log'
import {
  REPORT_V4_MIN_CHARTS,
  REPORT_V4_MIN_CHARTS_SHORT,
  REPORT_V4_MIN_TABLES,
  REPORT_V4_MIN_TABLES_SHORT,
} from '#services/report_v4/report_v4_constants'
import { synthesizeReportBriefFromDocument } from '#services/report_v4/report_brief'
import type { ReportBrief } from '#services/report_v4/report_brief'
import { pruneDocumentToClubPositions } from '#services/report_v4/position_catalog'
import { prepareReportV4Document } from '#services/report_v4/club_html_report'
import type { IsoDateRange } from '#services/report_v4/lookback_range'
import type { RosterAthlete } from '#services/report_v4/roster_macros'
import type { ReportV4Route } from '#services/report_v4/report_v4_router'
import type { ReportFact } from '#services/report_v4/report_facts'
import type { AppLanguage } from '#utils/localize'

import type { ClubInsightScience } from '#services/report_v4/club_insight_science'

export type ReportV4RunState = {
  route: ReportV4Route
  roster: RosterAthlete[]
  agentState: PremiumReportState
  reportBrief: ReportBrief | null
  facts: Map<string, ReportFact>
  htmlArtifact: string | null
  document: PremiumReportDocument
  usage: PremiumReportTokenUsage
  iterationSecs: number[]
  iterationCosts: number[]
  iterations: number
  allowNutritionScope: boolean
  clubName: string
  clubInsightScience?: ClubInsightScience[]
  templateRecoveredReason?: string | null
}

export type DatasetCatalogEntry = {
  id: string
  columns: string[]
  rows: number
  dateRange: IsoDateRange | null
}

export type CanvasStats = {
  charts: number
  tables: number
  thin: boolean
}

export const addUsage = (into: PremiumReportTokenUsage, add: PremiumReportTokenUsage): void => {
  into.inputTokens += add.inputTokens
  into.outputTokens += add.outputTokens
  into.cacheReadInputTokens += add.cacheReadInputTokens
  into.cacheCreationInputTokens += add.cacheCreationInputTokens
  into.totalTokens += add.totalTokens
  into.estimatedCostUsd += add.estimatedCostUsd
}

export const catalogDatasets = (state: PremiumReportState): DatasetCatalogEntry[] =>
  [...state.datasets.entries()].map(([id, dataset]) => ({
    id,
    columns: dataset.columns,
    rows: dataset.rows.length,
    dateRange: dataset.dateRange ?? null,
  }))

const formatDomainWindows = (byDomain: Partial<Record<string, IsoDateRange>>): string => {
  const entries = Object.entries(byDomain)
  if (!entries.length) return ''
  return entries
    .map(([domain, range]) => (range ? `${domain}:${range.from}→${range.to}` : ''))
    .filter(Boolean)
    .join(', ')
}

const formatFetchWindows = (
  fetches: Array<{
    domain: string
    from: string
    to: string
    metrics?: string[]
    label?: string
  }>
): string => {
  if (!fetches.length) return ''
  return fetches
    .map((row) => {
      const metrics = row.metrics?.length ? `[${row.metrics.join(',')}]` : ''
      const label = row.label ? ` (${row.label})` : ''
      return `${row.domain}${metrics}:${row.from}→${row.to}${label}`
    })
    .join(' | ')
}

export type TimeRangeBriefArgs = {
  displayRange: IsoDateRange
  coverRange: IsoDateRange
  fetchRange: IsoDateRange
  domainRanges?: Partial<Record<string, IsoDateRange>>
  fetches?: Array<{
    domain: string
    from: string
    to: string
    metrics?: string[]
    label?: string
  }>
  extraRanges?: IsoDateRange[]
  clubSeasonsBrief?: string
}

/** Canonical time-range block for EVERY agent system + user prompt (anti-hallucination). */
export const formatTimeRangeBrief = (args: TimeRangeBriefArgs): string => {
  const domainLine = args.domainRanges ? formatDomainWindows(args.domainRanges) : ''
  const fetchLine = args.fetches ? formatFetchWindows(args.fetches) : ''
  const extraLine = args.extraRanges?.length
    ? args.extraRanges.map((range) => `${range.from}→${range.to}`).join(' | ')
    : ''
  return [
    '## Time ranges (authoritative — honour exactly)',
    `Display: ${args.displayRange.from} → ${args.displayRange.to} (titles, ReportBrief.period, default narrative window).`,
    `Cover: ${args.coverRange.from} → ${args.coverRange.to} (union awareness ONLY — never default fetch / never retitle Display as Cover).`,
    `Load lookback: ${args.fetchRange.from} → ${args.fetchRange.to} (build_load_summary / EWMA-ACWR chronic only).`,
    fetchLine
      ? `Fetch windows (one macro call each): ${fetchLine}`
      : 'Fetch windows: none listed — use Display (load → Load lookback).',
    domainLine ? `Domain unions: ${domainLine}` : '',
    extraLine ? `Extra periods: ${extraLine}` : '',
    args.clubSeasonsBrief ? args.clubSeasonsBrief : '',
    'FORBIDDEN: inventing months outside these ranges, or labeling Cover/Lookback months as the Display period.',
  ]
    .filter(Boolean)
    .join('\n')
}

export const canvasStats = (
  document: PremiumReportDocument,
  floors?: { minCharts: number; minTables: number }
): CanvasStats => {
  const minCharts = floors?.minCharts ?? REPORT_V4_MIN_CHARTS
  const minTables = floors?.minTables ?? REPORT_V4_MIN_TABLES
  const charts = document.blocks.filter((block) => block.type === PREMIUM_BLOCK_TYPE.CHART).length
  const tables = document.blocks.filter((block) => block.type === PREMIUM_BLOCK_TYPE.TABLE).length
  return {
    charts,
    tables,
    thin: charts < minCharts || tables < minTables,
  }
}

const seriesStyleToken = (row: Record<string, unknown>): string => {
  const item =
    row.itemStyle && typeof row.itemStyle === 'object' && !Array.isArray(row.itemStyle)
      ? (row.itemStyle as { color?: unknown }).color
      : undefined
  const line =
    row.lineStyle && typeof row.lineStyle === 'object' && !Array.isArray(row.lineStyle)
      ? (row.lineStyle as { color?: unknown; width?: unknown }).color
      : undefined
  const encode =
    row.encode && typeof row.encode === 'object' && !Array.isArray(row.encode)
      ? (row.encode as { y?: unknown; value?: unknown })
      : undefined
  const y = encode?.y ?? encode?.value
  const dataLen = Array.isArray(row.data) ? row.data.length : 0
  return `${String(row.type ?? '')}:${String(row.name ?? '')}:${String(y ?? '')}:${String(item ?? line ?? '')}:${dataLen}`
}

const chartBlockSignature = (option: Record<string, unknown>, title: string): string => {
  const series = Array.isArray(option.series) ? option.series : []
  const seriesToken = series
    .map((row) =>
      row && typeof row === 'object' && !Array.isArray(row)
        ? seriesStyleToken(row as Record<string, unknown>)
        : ''
    )
    .join(',')
  const radar = option.radar != null ? 'radar' : ''
  const visual = option.visualMap != null ? 'vm' : ''
  return `${title}|${radar}|${visual}|${seriesToken}`
}

const tableBlockSignature = (block: PremiumTableBlock): string => {
  const heat = Boolean(
    block.option &&
    ((block.option as { heatLegend?: unknown }).heatLegend != null ||
      Array.isArray((block.option as { cells?: unknown }).cells))
  )
  const head = block.rows[0]?.map((cell) => String(cell ?? '')).join('|') ?? ''
  const tail =
    block.rows.length > 1
      ? (block.rows[block.rows.length - 1]?.map((cell) => String(cell ?? '')).join('|') ?? '')
      : ''
  return `${block.id}\t${block.title ?? ''}\t${block.columns.join(',')}\t${block.rows.length}\t${heat ? 'heat' : ''}\t${head}\t${tail}`
}

export const canvasSoftDigest = (document: PremiumReportDocument): string => {
  const parts: string[] = []
  for (const block of document.blocks) {
    if (block.type === PREMIUM_BLOCK_TYPE.CHART) {
      parts.push(`c:${block.id}\t${chartBlockSignature(block.option, block.title)}`)
      continue
    }
    if (block.type === PREMIUM_BLOCK_TYPE.TABLE) {
      parts.push(`t:${tableBlockSignature(block)}`)
      continue
    }
    if (block.type === PREMIUM_BLOCK_TYPE.HEADING) {
      parts.push(`h:${block.id}\t${block.level}\t${block.text}`)
      continue
    }
    if (block.type === PREMIUM_BLOCK_TYPE.TEXT) {
      parts.push(`x:${block.id}\t${block.text}`)
    }
  }
  return parts.join('\n')
}

export const rejectThinCanvas =
  (args: {
    preserveCanvas: boolean
    continueMsg: string
    shortWindow?: boolean
    priorSoftDigest?: string
  }) =>
  (state: PremiumReportState): string | null => {
    if (args.preserveCanvas) {
      if (!args.priorSoftDigest) return null
      if (canvasSoftDigest(state.document) === args.priorSoftDigest) return args.continueMsg
      return null
    }
    const hasHarvestData = [...state.datasets.values()].some(
      (dataset) => dataset.id !== 'roster' && dataset.rows.length > 0
    )
    if (!hasHarvestData) return null
    const minCharts = args.shortWindow ? REPORT_V4_MIN_CHARTS_SHORT : REPORT_V4_MIN_CHARTS
    const minTables = args.shortWindow ? REPORT_V4_MIN_TABLES_SHORT : REPORT_V4_MIN_TABLES
    const stats = canvasStats(state.document, { minCharts, minTables })
    if (stats.thin) {
      return `${args.continueMsg} (charts=${stats.charts}/${minCharts}, tables=${stats.tables}/${minTables})`
    }
    return null
  }

export const finalizeAnalystCanvas = (args: {
  document: PremiumReportDocument
  displayRange: IsoDateRange
  language: AppLanguage
  clubPostes: string[]
  fallbackTitle: string
  heatScales?: import('#services/premium_report/charts/echarts_options').SubjectiveChartScale[]
}): PremiumReportDocument => {
  const next = args.document
  if (!next.title.trim()) {
    next.title = args.fallbackTitle.replace(/\s+/g, ' ').trim().slice(0, 80)
  }
  next.dateRange = { from: args.displayRange.from, to: args.displayRange.to }
  const prepared = pruneDocumentToClubPositions(
    prepareReportV4Document(
      sanitizeIncomingDocument(next, args.displayRange, args.language),
      args.language,
      args.heatScales
    ),
    args.clubPostes
  )
  const pruned = dropEmptyChartBlocks(prepared)
  if (pruned.dropped.length) {
    logger.warn({ dropped: pruned.dropped }, 'report_v4.dropped_empty_charts')
  }
  return pruned.document
}

export const synthesizeReportBriefIfMissing = (args: {
  insight: ReportBrief | null
  document: PremiumReportDocument
  displayRange: IsoDateRange
  harvestHasRows?: boolean
}): ReportBrief | null => {
  if (args.insight) return args.insight
  const isDataProfileBlock = (id: string): boolean =>
    id === 'data_profile_heading' || id === 'data_profile_body'
  const headings = args.document.blocks
    .filter(
      (block) => block.type === PREMIUM_BLOCK_TYPE.HEADING && !isDataProfileBlock(block.id)
    )
    .map((block) => (block.type === PREMIUM_BLOCK_TYPE.HEADING ? block.text.trim() : ''))
    .filter(Boolean)
  const textBullets = args.document.blocks
    .filter((block) => block.type === PREMIUM_BLOCK_TYPE.TEXT && !isDataProfileBlock(block.id))
    .flatMap((block) =>
      block.type === PREMIUM_BLOCK_TYPE.TEXT
        ? block.text
            .split('\n')
            .map((line) => line.replace(/^[-*•]\s+/, '').trim())
            .filter((line) => line.length >= 12)
        : []
    )
  if (args.harvestHasRows) {
    logger.warn(
      { title: args.document.title, headings: headings.length },
      'report_v4.report_brief_synthesized_after_missing_commit'
    )
  } else {
    logger.warn({ headings: headings.length }, 'report_v4.report_brief_synthesized')
  }
  return synthesizeReportBriefFromDocument({
    title: args.document.title,
    period: args.displayRange,
    headings,
    textBullets,
  })
}

export const heatStaffTablesInDocument = (
  document: PremiumReportDocument,
  language: AppLanguage,
  scales?: StaffHeatScale[]
): PremiumReportDocument => {
  document.blocks = document.blocks.map((block) => {
    if (block.type !== PREMIUM_BLOCK_TYPE.TABLE) return block
    const option = block.option
    const hadHeat = Boolean(
      option &&
      typeof option === 'object' &&
      !Array.isArray(option) &&
      (option as { heatLegend?: unknown }).heatLegend != null
    )
    return applyTableHeat(block, language, {
      heat: hadHeat || shouldHeatStaffTable(block),
      scales,
    })
  })
  return document
}
