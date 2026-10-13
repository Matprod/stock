import { PREMIUM_BLOCK_TYPE } from '#constants/premium_report.constants'
import type { ReportDateRange } from '#contracts/report_builder'

export type PremiumReportDateRange = ReportDateRange

export type PremiumHeadingBlock = {
  id: string
  type: typeof PREMIUM_BLOCK_TYPE.HEADING
  text: string
  level?: 1 | 2
}

export type PremiumTextBlock = {
  id: string
  type: typeof PREMIUM_BLOCK_TYPE.TEXT
  text: string
}

export type PremiumChartBlock = {
  id: string
  type: typeof PREMIUM_BLOCK_TYPE.CHART
  title: string
  option: Record<string, unknown>
}

export type PremiumTableCellStyle = {
  background?: string
  color?: string
  bold?: boolean
  align?: 'left' | 'center' | 'right'
}

export type PremiumTableBlock = {
  id: string
  type: typeof PREMIUM_BLOCK_TYPE.TABLE
  title?: string
  columns: string[]
  rows: Array<Array<string | number | null>>
  option?: Record<string, unknown>
}

export type PremiumReportBlock =
  PremiumHeadingBlock | PremiumTextBlock | PremiumChartBlock | PremiumTableBlock

export type PremiumReportDocumentDraft = {
  title?: string
  dateRange: PremiumReportDateRange
  athleteIds?: string[]
  blocks?: Array<{
    id: string
    type: string
    text?: string | null
    level?: number | null
    title?: string | null
    option?: unknown
    columns?: string[]
    rows?: unknown[][]
  }>
}

export type PremiumReportDocument = {
  title: string
  dateRange: PremiumReportDateRange
  athleteIds?: string[]
  blocks: PremiumReportBlock[]
}

export type PremiumReportHistoryTurn = {
  role: 'user' | 'assistant'
  content: string
}

export type PremiumReportGenerateInput = {
  prompt: string
  dateRange: PremiumReportDateRange
  athleteIds?: string[]
  history?: PremiumReportHistoryTurn[]
  document?: PremiumReportDocumentDraft
  reportId?: string
}

export type PremiumReportGenerateResult = {
  document: PremiumReportDocument
  message: string
  iterations: number
  reportId?: string
}

export type PremiumDataset = {
  id: string
  columns: string[]
  rows: Array<Record<string, unknown>>
  units?: Record<string, string>
  labels?: Record<string, string>
  dateRange?: PremiumReportDateRange
}
