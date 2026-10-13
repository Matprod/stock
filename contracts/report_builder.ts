import type { MetricAggregationMethod } from '#constants/metrics.constants'
import type {
  ReportBlocType,
  ReportCatalogGroup,
  ReportVariablePrefix,
  ReportBlocSplit,
  ReportSeriesOp,
  ReportFormulaId,
  ReportLineDash,
} from '#constants/report_builder.constants'
import type { FrontendChart } from '#utils/chart'

export type ReportDateRange = {
  from: string
  to: string
}

export type ReportFormulaSpec = {
  id: ReportFormulaId
  params?: Record<string, number | boolean>
}

export type ReportTheme = {
  colors?: string[]
}

export type ReportSeriesSpec = {
  id: string
  label?: string
  op?: ReportSeriesOp
  variables: string[]
  formula?: ReportFormulaSpec
  convert?: string
  color?: string
  dash?: ReportLineDash
}

export type ReportBlocSpec = {
  id: string
  type: ReportBlocType
  variables?: string[]
  series?: ReportSeriesSpec[]
  athleteIds?: string[]
  split?: ReportBlocSplit
  dateRange?: ReportDateRange
  text?: string
}

export type ReportVariableMeta = {
  key: string
  group: ReportCatalogGroup
  name: string
  description: string
  unit: string | null
  aggregation: MetricAggregationMethod
}

export type ReportVariableDefinition = ReportVariableMeta & {
  prefix: ReportVariablePrefix
  field: string
}

export type ReportCatalog = {
  variables: ReportVariableMeta[]
}

export type ReportRawPoint = {
  date: string
  value: number
  athleteId: string
}

export type ReportTimeSeriesCurve = {
  athleteId: string
  activityId: string
  date: string
  points: Array<{ elapsedSec: number; value: number }>
}

export type ReportData = {
  dates: string[]
  points: Record<string, ReportRawPoint[]>
  curves: Record<string, ReportTimeSeriesCurve[]>
  tables: Record<string, ReportTable>
  meta: Record<string, ReportVariableMeta>
  athletes: Record<string, string>
  theme?: ReportTheme
}

export type ReportTableColumn = {
  key: string
  label: string
}

export type ReportTableRow = {
  key: string
  athleteId: string
  start: string
  end: string | null
  cells: Record<string, string>
}

export type ReportTable = {
  columns: ReportTableColumn[]
  rows: ReportTableRow[]
}

export type ReportKpiItem = {
  key: string
  label: string
  value: number | null
  unit: string | null
}

export type ReportKpiGroup = {
  key: string
  label: string
  items: ReportKpiItem[]
}

export type ReportGraphContent = {
  charts: FrontendChart[]
}

export type ReportKpiContent = {
  groups: ReportKpiGroup[]
}

export type ReportTableContent = {
  title?: string
  columns: ReportTableColumn[]
  rows: ReportTableRow[]
}

export type ReportTextContent = {
  text: string
}

export type ReportBlocContent =
  | ReportGraphContent
  | ReportKpiContent
  | ReportTableContent
  | ReportTextContent

export type RenderedReportBloc = {
  id: string
  type: ReportBlocType
  variables: string[]
  series: ReportSeriesSpec[]
  athleteIds?: string[]
  split: ReportBlocSplit
  dateRange?: ReportDateRange
  text?: string
  content: ReportBlocContent
}

export type ReportDocument = {
  title?: string
  dateRange: ReportDateRange
  theme?: ReportTheme
  blocs: RenderedReportBloc[]
}

export type ReportGenerateInput = {
  title?: string
  dateRange: ReportDateRange
  blocs: ReportBlocSpec[]
  theme?: ReportTheme
  useImputedMetrics?: boolean
}

export type ReportChatbotInput = ReportGenerateInput & {
  prompt: string
  history?: Array<{ role: 'user' | 'assistant'; content: string }>
}

export type ReportChatbotResult = ReportGenerateInput & {
  message: string
}

export type ReportTemplate = {
  id: string
  title: string
  dateRange: ReportDateRange
  blocs: ReportBlocSpec[]
  createdBy: string | null
  createdAt: string
  updatedAt: string
}
