import type { PremiumReportState, PremiumTool } from '#services/premium_report/premium_report_tools'
import { createChartDocumentTools } from '#services/premium_report/tools_document_charts'
import { createMutateDocumentTools } from '#services/premium_report/tools_document_mutate'
import { createTableDocumentTools } from '#services/premium_report/tools_document_table'
import { createTeamDocumentTools } from '#services/premium_report/tools_document_team'
import { createTextDocumentTools } from '#services/premium_report/tools_document_text'

export const createPremiumDocumentTools = (state: PremiumReportState): PremiumTool[] => [
  ...createTextDocumentTools(state),
  ...createChartDocumentTools(state),
  ...createTableDocumentTools(state),
  ...createTeamDocumentTools(state),
  ...createMutateDocumentTools(state),
]
