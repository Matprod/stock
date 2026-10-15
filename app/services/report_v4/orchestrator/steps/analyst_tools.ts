import * as m from '#services/report_v4/orchestrator/main_pipeline_bindings'
import type { PipelineState } from '#services/report_v4/orchestrator/pipeline_state'
import type { PremiumDomain } from '#constants/premium_report_domains'
import type { PremiumTool } from '#services/premium_report/premium_report_tools'

const SHEET_RECREATE_TOOL_NAMES = new Set(['add_chart', 'add_heading', 'add_table'])
const SHEETS_PREBUILT_STRIP_TOOL_NAMES = new Set([
  ...SHEET_RECREATE_TOOL_NAMES,
  'remove_block',
])

const documentToolsForAnalyst = (args: {
  agentState: PipelineState['agentState']
  individualSheetsFullGenerate: boolean
}): PremiumTool[] => {
  const tools = m.createPremiumDocumentTools(args.agentState)
  if (!args.individualSheetsFullGenerate) return tools
  return tools.filter((tool) => !SHEETS_PREBUILT_STRIP_TOOL_NAMES.has(tool.schema.name))
}

export const buildAnalystTools = async (params: {
  agentState: PipelineState['agentState']
  run: PipelineState['run']
  roster: PipelineState['roster']
  makeDbTool: PipelineState['makeDbTool']
  domains: PremiumDomain[]
  preserveCanvas: boolean
  needsFetch: boolean
  softDataMutate: boolean
  isMicroSoft: boolean
  keepMacros: boolean
  envelope: string
  individualSheets?: boolean
  requiredAthletes?: string[]
  requiredMetrics?: string[]
}) => {
  const {
    agentState,
    run,
    roster,
    makeDbTool,
    domains,
    preserveCanvas,
    needsFetch,
    softDataMutate,
    isMicroSoft,
    keepMacros,
    envelope,
    individualSheets,
    requiredAthletes = [],
    requiredMetrics = [],
  } = params
  const individualSheetsFullGenerate = Boolean(individualSheets) && !isMicroSoft && !preserveCanvas
  const sheetTools: PremiumTool[] = individualSheets
    ? m.createAthleteSheetsTools({
        state: agentState,
        roster,
        requiredAthletes,
        domains,
        metrics: requiredMetrics,
        getBrief: () => run.reportBrief,
      })
    : []
  const docTools = documentToolsForAnalyst({
    agentState,
    individualSheetsFullGenerate,
  })
  const withFactTools = <T extends PremiumTool[]>(tools: T) =>
    [...tools, ...m.createReportFactTools(run)] as T
  if (preserveCanvas && !needsFetch && !softDataMutate) {
    agentState.blockSql = true
    return withFactTools([...docTools, ...sheetTools, ...m.createReportBriefTools(run)])
  }
  if (isMicroSoft || (preserveCanvas && !softDataMutate)) {
    agentState.blockSql = true
    return withFactTools([...docTools, ...sheetTools, ...m.createReportBriefTools(run)])
  }
  const macroDomains = m.allPremiumMacroDomains()
  const dataAndDoc = withFactTools([
    ...m.createPremiumDataTools(agentState, { domains: macroDomains }),
    ...docTools,
    ...sheetTools,
    ...m.createReportBriefTools(run),
  ])
  if (!keepMacros) return dataAndDoc
  const dbTool = await makeDbTool(envelope)
  const runSql = async (sql: string) => dbTool.execute({ sql })
  return [
    ...m.createPremiumMacroTools({ state: agentState, runSql, domains: macroDomains }),
    ...m.createWellnessSleepMacroTools({
      state: agentState,
      runSql,
      includeWellness: true,
      includeSleep: true,
    }),
    m.createRosterMacroTool({ state: agentState, roster }),
    ...dataAndDoc,
  ]
}
