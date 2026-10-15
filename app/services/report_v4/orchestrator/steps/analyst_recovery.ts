import type { PremiumAgentResult } from '#services/premium_report/premium_report_agent_types'
import * as m from '#services/report_v4/orchestrator/main_pipeline_bindings'
import type { PipelineState } from '#services/report_v4/orchestrator/pipeline_state'

type RecoveryResult = Pick<
  PremiumAgentResult,
  'usage' | 'iterations' | 'stopClass' | 'maxIterations' | 'forceAnswerAt'
>

export const runAnalystRecovery = async (
  state: PipelineState,
  envelope: string
): Promise<RecoveryResult | null> => {
  const { ctx } = state
  const { args, deps: d, framed, plan: planRaw } = ctx
  const { club, multiSectionAsk, displayRange, clubPostes } = framed
  const { policy, route, domains, useShortDepth, harvestPlan, contentFloors } = planRaw
  const {
    run,
    agentState,
    makeDbTool,
    catalog,
    periodKpis,
    roster,
    dataProfilePacket,
    wellnessCatalogue,
    subjectiveScalesLine,
    onIteration,
  } = state

  const liveContentFloors = (() => {
    if (contentFloors.mode === 'explicit' || contentFloors.mode === 'none') return contentFloors
    const verdicts = m.verifyHarvestPlan(agentState, harvestPlan).verdicts
    const withRows = new Set(
      verdicts.filter((row) => row.status === 'rows').map((row) => row.domain)
    )
    return m.resolveContentFloors({
      prompt: args.prompt,
      domainsWithDataCount: [...withRows].length,
      preserveCanvas: false,
    })
  })()
  const hasHarvestData = m.harvestHasUsableDatasets(agentState)
  const needsRecovery =
    !framed.preserveCanvas &&
    !useShortDepth &&
    hasHarvestData &&
    m.canvasStats(agentState.document, liveContentFloors).thin

  if (!hasHarvestData && !framed.preserveCanvas) {
    m.logger.info(
      { charts: m.canvasStats(agentState.document, liveContentFloors).charts },
      'report_v4.analyst_recovery_skipped_empty_harvest'
    )
  }
  if (!needsRecovery) return null

  m.logger.warn(
    { ...m.canvasStats(agentState.document, liveContentFloors) },
    'report_v4.analyst_thin_canvas_recovery'
  )
  agentState.requestPrompt = [
    envelope,
    m.REPORT_V4_ANALYST_RECOVERY_CONTINUE,
    `Current charts=${m.canvasStats(agentState.document, liveContentFloors).charts} tables=${m.canvasStats(agentState.document, liveContentFloors).tables}`,
    `Use datasetIds: ${
      m
        .catalogDatasets(agentState)
        .map((d) => d.id)
        .join(', ') || 'none — call macros first'
    }`,
  ].join('\n')
  agentState.mustUseTools = true
  agentState.toolHistory = []
  agentState.blockSql = true
  const recoveryDbTool = await makeDbTool(agentState.requestPrompt)
  const recoveryRunSql = async (sql: string) => recoveryDbTool.execute({ sql })
  const macroDomains = m.allPremiumMacroDomains()
  const recoveryTools = [
    ...m.createPremiumMacroTools({
      state: agentState,
      runSql: recoveryRunSql,
      domains: macroDomains,
    }),
    ...m.createWellnessSleepMacroTools({
      state: agentState,
      runSql: recoveryRunSql,
      includeWellness: true,
      includeSleep: true,
    }),
    m.createRosterMacroTool({ state: agentState, roster }),
    ...m.createPremiumDataTools(agentState, { domains: macroDomains }),
    ...m.createPremiumDocumentTools(agentState),
    ...(planRaw.artifactEnvelope.coverage.individualSheets
      ? m.createAthleteSheetsTools({
          state: agentState,
          roster,
          requiredAthletes: planRaw.artifactEnvelope.coverage.requiredNames,
          domains,
          metrics: planRaw.artifactEnvelope.harvest.requiredMetrics,
          getBrief: () => run.reportBrief,
        })
      : []),
    ...m.createReportBriefTools(run),
    ...m.createReportFactTools(run),
  ]
  const analystRunArgs = {
    clubId: args.clubId,
    clubName: club.name,
    displayRange,
    domains,
    route,
    language: args.language,
    policy,
    clubPostes,
    periodKpis,
    catalog,
    coachPrompt: args.prompt,
    multiSection: multiSectionAsk,
    dataProfileHint: state.dataProfileHint,
    clubInsightScienceHint: state.clubInsightScienceHint,
    subjectiveScalesLine: subjectiveScalesLine || undefined,
    namedAthletes: planRaw.namedAthletes,
  }
  const recovery = await d.runPremiumReportAgent({
    systemStable: m.buildAnalystSystemStable(),
    systemRun: m.buildAnalystSystemRun(analystRunArgs),
    userPrompt: JSON.stringify({
      stage: 'analyst_recovery',
      clubPostes,
      datasets: m.catalogDatasets(agentState),
      current: m.compactPremiumDocument(agentState.document),
      request: agentState.requestPrompt,
      ...(dataProfilePacket ? { dataProfile: dataProfilePacket } : {}),
      ...(subjectiveScalesLine
        ? { subjectiveScales: m.projectWellnessScalesForDesigner(wellnessCatalogue) }
        : {}),
    }),
    history: [],
    tools: recoveryTools,
    state: agentState,
    maxIterations: m.REPORT_V4_ANALYST_RECOVERY_MAX_ITERATIONS,
    forceAnswerAt: m.REPORT_V4_ANALYST_RECOVERY_MAX_ITERATIONS - 1,
    minIterations: 2,
    maxEndTurnNudges: 5,
    continuePrompt: m.REPORT_V4_ANALYST_RECOVERY_CONTINUE,
    acceptEndTurn: (s) => {
      const thin = m.rejectThinCanvas({
        preserveCanvas: false,
        continueMsg: m.REPORT_V4_ANALYST_RECOVERY_CONTINUE,
        floors: liveContentFloors,
      })(s)
      if (thin) return thin
      return m.rejectAnalystUngroundedEndTurn({
        getBrief: () => run.reportBrief,
        roster,
        allowNutritionScope: policy.allowNutritionScope,
        requireBrief: true,
        clubName: club.name,
      })(s)
    },
    maxTokens: m.REPORT_V4_MAX_TOKENS,
    temperature: m.REPORT_V4_TEMPERATURE,
    onIteration: onIteration('analyst_recovery'),
    signal: args.signal,
  })
  m.addUsage(run.usage, recovery.usage)
  run.iterations += recovery.iterations
  agentState.blockSql = false
  m.logReportV4AgentStop({
    agent: 'analyst_recovery',
    stopClass: recovery.stopClass,
    iterations: recovery.iterations,
    maxIterations: recovery.maxIterations,
    forceAnswerAt: recovery.forceAnswerAt,
    profile: 'full',
  })
  return {
    usage: recovery.usage,
    iterations: recovery.iterations,
    stopClass: recovery.stopClass,
    maxIterations: recovery.maxIterations,
    forceAnswerAt: recovery.forceAnswerAt,
  }
}
