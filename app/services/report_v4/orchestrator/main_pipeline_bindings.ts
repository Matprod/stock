export {
  PREMIUM_CANVAS_ASK,
  PREMIUM_REPORT_HISTORY_MAX,
  PREMIUM_REPORT_SQL_MAX_BYTES,
  PREMIUM_REPORT_SQL_MAX_ROWS,
} from '#constants/premium_report.constants'
export type { PremiumAgentIterationEvent } from '#services/premium_report/premium_report_agent'
export {
  PREMIUM_DOMAIN,
  allPremiumMacroDomains,
  schemaTitlesForDomains,
} from '#constants/premium_report_domains'
export {
  clubMetricCatalog,
  resolveClubMetricCatalogRange,
} from '#services/premium_report/club_metric_catalog'
export { formatRpeProbeBrief, probeRpeSources } from '#services/premium_report/rpe_source_probe'
export type { AgentContext } from '#contracts/agent'
export { createDbTool } from '#services/agent_db_tool'
export { formulaCatalogForLlm } from '#services/report_v4/metrics/formula_llm'
export {
  clonePremiumDocument,
  compactPremiumDocument,
} from '#services/premium_report/premium_report_document'
export { emptyUsage } from '#services/premium_report/premium_report_agent'
export { createPremiumDataTools, allowedFormulaIds } from '#services/premium_report/tools_data'
export { createPremiumMacroTools } from '#services/premium_report/tools_macros'
export { createPremiumDocumentTools } from '#services/premium_report/tools_document'
export {
  wrapQueryTool,
  type PremiumReportState,
} from '#services/premium_report/premium_report_tools'
export {
  REPORT_V4_ANALYST_FORCE_ANSWER_AT,
  REPORT_V4_ANALYST_FORCE_ANSWER_AT_SHORT,
  REPORT_V4_ANALYST_MAX_ITERATIONS,
  REPORT_V4_ANALYST_MAX_ITERATIONS_SHORT,
  REPORT_V4_ANALYST_MIN_ITERATIONS,
  REPORT_V4_ANALYST_MIN_ITERATIONS_DEEP,
  REPORT_V4_ANALYST_MIN_ITERATIONS_SHORT,
  REPORT_V4_ANALYST_RECOVERY_MAX_ITERATIONS,
  REPORT_V4_DESIGNER_FORCE_ANSWER_AT,
  REPORT_V4_DESIGNER_MAX_ITERATIONS,
  REPORT_V4_DESIGNER_MAX_TOKENS,
  REPORT_V4_DESIGNER_MIN_ITERATIONS,
  REPORT_V4_LEAN_WINDOW_DAYS,
  REPORT_V4_LINKER_FORCE_ANSWER_AT,
  REPORT_V4_LINKER_FORCE_ANSWER_AT_SHORT,
  REPORT_V4_LINKER_MAX_ITERATIONS,
  REPORT_V4_LINKER_MAX_ITERATIONS_SHORT,
  REPORT_V4_LINKER_MAX_TOKENS_SHORT,
  REPORT_V4_LINKER_MIN_ITERATIONS,
  REPORT_V4_LINKER_MIN_ITERATIONS_SHORT,
  REPORT_V4_MAX_BLOCKS,
  REPORT_V4_MAX_CHARTS,
  REPORT_V4_MAX_END_TURN_NUDGES,
  REPORT_V4_MAX_TOKENS,
  REPORT_V4_SOFT_ANALYST_ADDITIVE_FORCE_ANSWER_AT,
  REPORT_V4_SOFT_ANALYST_ADDITIVE_MAX_ITERATIONS,
  REPORT_V4_SOFT_ANALYST_FORCE_ANSWER_AT,
  REPORT_V4_SOFT_ANALYST_MAX_ITERATIONS,
  REPORT_V4_SOFT_ANALYST_MIN_ITERATIONS,
  REPORT_V4_SOFT_LINKER_FORCE_ANSWER_AT,
  REPORT_V4_SOFT_LINKER_MAX_ITERATIONS,
  REPORT_V4_SOFT_LINKER_MIN_ITERATIONS,
  REPORT_V4_TEMPERATURE,
} from '#services/report_v4/report_v4_constants'
export {
  REPORT_V4_ANALYST_CONTINUE,
  REPORT_V4_ANALYST_RECOVERY_CONTINUE,
  REPORT_V4_DESIGNER_CONTINUE,
  REPORT_V4_LINKER_CONTINUE,
  softAnalystContinueForAsk,
  buildAnalystSystemPrompt,
  buildAnalystSystemRun,
  buildAnalystSystemStable,
  buildDesignerSystemPrompt,
  buildDesignerSystemRun,
  buildDesignerSystemStable,
  buildLinkerSystemPrompt,
  buildLinkerSystemRun,
  buildLinkerSystemStable,
  buildSoftAnalystSystemPrompt,
  buildSoftAnalystSystemRun,
  buildSoftAnalystSystemStable,
} from '#services/report_v4/agents/agent_prompts'
export {
  createDesignerTools,
  createReportBriefTools,
  formatClubSubjectiveScalesBrief,
  projectHeatScalesFromCatalogue,
  projectSubjectiveScalesForProfiler,
  projectWellnessScalesForDesigner,
  renderDesignerTemplateArtifact,
} from '#services/report_v4/agents/stage_tools'
export { createReportFactTools } from '#services/report_v4/agents/fact_tools'
export { precomputeCanvasFacts } from '#services/report_v4/precompute_canvas_facts'
export { precomputeAskFacts } from '#services/report_v4/precompute_ask_facts'
export { mapPresentPlayersByDataset } from '#services/report_v4/present_players'
export { ensureMissingDomainNotices } from '#services/report_v4/missing_domain_notice'
export { recordHarvestTried } from '#services/report_v4/harvest_plan'
export { SubjectiveScaleService } from '#services/subjective_scale_service'
export { createWellnessSleepMacroTools } from '#services/report_v4/wellness_sleep_macros'
export {
  applySignedPhotosInHtml,
  collectInsightAthleteNames,
  createRosterMacroTool,
  resolveInsightRosterPhotos,
} from '#services/report_v4/roster_macros'
export {
  artifactHtmlLooksValid,
  collectArtifactCharts,
  collectArtifactTables,
  countPresentChartHosts,
  freeArtifactTooThinForCharts,
  refreshArtifactPresentationCss,
  stripRecommendationSectionsFromDocument,
} from '#services/report_v4/artifact_html'
export {
  buildAskRequirements,
  evaluateAskContract,
  resolveContentFloors,
  verifyAskContract,
  resolveRequestedMeasure,
  enforceRequestedMeasure,
} from '#services/report_v4/request/ask_contract'
export { evaluateArtifactParity } from '#services/report_v4/artifact_parity'
export {
  formatSoftEditPathMessage,
  refusalFromDiffGate,
  refusalFromTemplateRecovered,
  type SoftEditPath,
  type SoftRefusal,
} from '#services/report_v4/soft_refusal'
export {
  acwrHarvestNudge,
  analystIterationBudget,
  analystPacketFromEnvelope,
  annotateBriefCoverageShortfall,
  buildSoftRunSummary,
  coverageGateMessage,
  evaluateCoverageGate,
  evaluateSoftDiffGate,
  prepareSoftArtifactPath,
  pathCostBudgetUsd,
  resolvePathCostClass,
  verifyAcwrHarvest,
} from '#services/report_v4/artifact_runtime/index'
export { buildSoftArtifactOutline } from '#services/report_v4/artifact_sections'
export { softOpsAgentPacket } from '#services/report_v4/soft_canvas_inventory'
export { applyResolvedSoftEditorial } from '#services/report_v4/soft_edit_ops'
export { askCoverageContinue } from '#services/report_v4/ask_domain_resolve'
export {
  acceptLinkerHarvestEndTurn,
  harvestHasUsableDatasets,
  hasLinkedData,
  verifyHarvestPlan,
} from '#services/report_v4/harvest_plan'
export {
  createAthleteSheetsTools,
  executeBuildAthleteSheets,
} from '#services/report_v4/athlete_sheets'
export {
  addUsage,
  canvasSoftDigest,
  canvasStats,
  catalogDatasets,
  finalizeAnalystCanvas,
  heatStaffTablesInDocument,
  rejectThinCanvas,
  synthesizeReportBriefIfMissing,
  type ReportV4RunState,
} from '#services/report_v4/orchestrator_helpers'
export {
  realignCrossedSectionProse,
  rejectAnalystUngroundedEndTurn,
  stripNutritionProseFromDocument,
  stripNutritionProseFromHtml,
  stripUngroundedVizBlocks,
} from '#services/report_v4/grounding_report'
export {
  compactDataProfileForLlm,
  formatDataProfileAnalystHint,
  profileHarvestDatasets,
  type HarvestDataProfile,
} from '#services/report_v4/data_profiler'
export {
  markImputedCells,
  formatImputedExclusionLine,
  type ImputedMarkSummary,
} from '#services/report_v4/imputed_cells'
export { ensureDataReliabilityBlocks } from '#services/report_v4/data_reliability'
export {
  formatClubInsightScienceAnalystHint,
  loadClubInsightScience,
  type ClubInsightScience,
} from '#services/report_v4/club_insight_science'
export { COACH_REPORT_SHAPE } from '#services/report_v4/coach_policy_heuristic'
export {
  logReportV4AgentStop,
  logReportV4AgentTotal,
  logReportV4Banner,
  logReportV4Iteration,
} from '#services/premium_report/premium_report_log'
export { buildSessionFocus } from '#services/report_v4/session_focus'
export { Exception } from '@adonisjs/core/exceptions'
export { default as logger } from '@adonisjs/core/services/logger'
