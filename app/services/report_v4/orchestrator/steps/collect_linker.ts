import * as m from '#services/report_v4/orchestrator/main_pipeline_bindings'
import type { PipelineState } from '#services/report_v4/orchestrator/pipeline_state'

export const runLinkerAgent = async (state: PipelineState): Promise<void> => {
  const { ctx } = state
  const { args, deps: d, coverage, progress, framed } = ctx
  const {
    club,
    preserveCanvas,
    needsFetch,
    displayRange,
    fetchWindows,
    coverRange,
    fetchRange,
    timeRangesBrief,
    clubPostes,
    athleteIds,
  } = framed
  const { shortWindow, policy, route, domains, harvestPlan, artifactEnvelope } = ctx.plan
  const {
    run,
    agentState,
    roster,
    athletes,
    makeDbTool,
    periodKpis,
    rpeProbe,
    metricWhitelist,
    schemaTitles,
    onIteration,
    sumSecs,
  } = state

  if (!needsFetch) {
    m.logger.info({ preserveCanvas: true }, 'report_v4.linker_skipped_soft_edit')
    return
  }

  m.logger.info(
    { domains, fetchWindows: fetchWindows.length, athleteCount: athleteIds.length },
    'report_v4.linker_start'
  )
  progress('collect_data', 'collect_data')
  const envelope = [
    '[REPORT_V4_LINKER]',
    `Club: ${club.name}`,
    timeRangesBrief,
    `Allowed domains: ${domains.join(',')}`,
    `Club postes: ${clubPostes.join(', ') || 'none'}`,
    `Coverage populated: ${coverage.populatedDomains.join(',') || 'none'}`,
    `Coverage empty: ${coverage.emptyDomains.join(',') || 'none'}`,
    m.formatRpeProbeBrief(rpeProbe),
    policy.excludedDomains.length ? `Banned domains: ${policy.excludedDomains.join(',')}` : '',
    policy.monitoringPlaybook ? 'Mode: monitoring playbook' : '',
    preserveCanvas
      ? 'SOFT EDIT: fetch ONLY domains required by the coach delta — do not refetch the whole stack.'
      : '',
    'Fetch windows = complete map. SAME domain may appear twice with different from/to (e.g. wellness mood vs stress) — call the macro twice with those exact dates. load → Load lookback. Never expand every macro to Cover.',
    'FORBIDDEN: inventing a distant month the coach did not name. Fetch windows may be far from Display — honour them.',
    'One macro call per Fetch-windows entry (allowed + populated). Label datasets with their dateRange. If metrics=[mood] etc., keep that slice for the analyst.',
    'If coach asks for scores → fetch_daily_scores. If biomarkers → fetch_biomarkers_daily on its fetch window. Do not skip Fetch-windows domains that are allowed and populated.',
    `Coach: ${args.prompt.trim()}`,
  ]
    .filter(Boolean)
    .join('\n')
  agentState.requestPrompt = envelope
  const dbToolStarted = Date.now()
  m.logger.info({ schemaTitles: schemaTitles.length }, 'report_v4.linker_db_tool_start')
  const dbTool = await makeDbTool(envelope)
  m.logger.info({ durationMs: Date.now() - dbToolStarted }, 'report_v4.linker_db_tool_done')
  const runSql = async (sql: string) => dbTool.execute({ sql })
  const macroDomains = m.allPremiumMacroDomains()
  const tools = [
    m.wrapQueryTool(dbTool, agentState),
    ...m.createPremiumMacroTools({ state: agentState, runSql, domains: macroDomains }),
    ...m.createWellnessSleepMacroTools({
      state: agentState,
      runSql,
      includeWellness: true,
      includeSleep: true,
    }),
    m.createRosterMacroTool({ state: agentState, roster }),
    ...m.createPremiumDataTools(agentState, { domains: macroDomains }),
  ]
  m.logger.info({ toolCount: tools.length }, 'report_v4.linker_agent_invoke')
  const linkerRunArgs = {
    clubId: args.clubId,
    clubName: club.name,
    displayRange,
    fetchRange,
    coverRange,
    timeRanges: timeRangesBrief,
    domains,
    route,
    policy,
    clubPostes,
    schemaTitles,
  }
  const result = await d.runPremiumReportAgent({
    systemStable: m.buildLinkerSystemStable(),
    systemRun: m.buildLinkerSystemRun(linkerRunArgs),
    userPrompt: JSON.stringify({
      stage: 'linker',
      athletes,
      domains,
      clubPostes,
      excludedDomains: policy.excludedDomains,
      monitoringPlaybook: policy.monitoringPlaybook,
      gpsMacroColumns: periodKpis.map((k) => k.alias),
      playerLoadSources: [],
      periodMetricWhitelist: metricWhitelist ?? undefined,
      softEdit: preserveCanvas,
      request: envelope,
    }),
    history: [],
    tools,
    state: agentState,
    maxIterations: preserveCanvas
      ? m.REPORT_V4_SOFT_LINKER_MAX_ITERATIONS
      : shortWindow
        ? m.REPORT_V4_LINKER_MAX_ITERATIONS_SHORT
        : m.REPORT_V4_LINKER_MAX_ITERATIONS,
    forceAnswerAt: preserveCanvas
      ? m.REPORT_V4_SOFT_LINKER_FORCE_ANSWER_AT
      : shortWindow
        ? m.REPORT_V4_LINKER_FORCE_ANSWER_AT_SHORT
        : m.REPORT_V4_LINKER_FORCE_ANSWER_AT,
    minIterations: preserveCanvas
      ? m.REPORT_V4_SOFT_LINKER_MIN_ITERATIONS
      : shortWindow
        ? m.REPORT_V4_LINKER_MIN_ITERATIONS_SHORT
        : m.REPORT_V4_LINKER_MIN_ITERATIONS,
    maxEndTurnNudges: preserveCanvas
      ? Math.max(2, Math.min(4, harvestPlan.length + 1))
      : m.REPORT_V4_MAX_END_TURN_NUDGES,
    continuePrompt: m.REPORT_V4_LINKER_CONTINUE,
    acceptEndTurn: (s) => {
      const harvestNudge = m.acceptLinkerHarvestEndTurn(s, harvestPlan)
      if (harvestNudge) return harvestNudge
      return m.acwrHarvestNudge(m.verifyAcwrHarvest(s, artifactEnvelope.harvest.requiredMetrics))
    },
    maxTokens: preserveCanvas
      ? m.REPORT_V4_MAX_TOKENS
      : shortWindow
        ? m.REPORT_V4_LINKER_MAX_TOKENS_SHORT
        : m.REPORT_V4_MAX_TOKENS,
    temperature: m.REPORT_V4_TEMPERATURE,
    onIteration: onIteration('linker'),
    signal: args.signal,
  })
  m.addUsage(run.usage, result.usage)
  run.iterations += result.iterations
  const datasets = m.catalogDatasets(agentState).length
  const harvestVerification = m.verifyHarvestPlan(agentState, harvestPlan)
  const acwrHarvest = m.verifyAcwrHarvest(agentState, artifactEnvelope.harvest.requiredMetrics)
  if (artifactEnvelope.harvest.requireLoadDomain) {
    state.acwrHarvestStatus = acwrHarvest.status
  }
  if (!acwrHarvest.ok) {
    m.logger.warn(
      {
        status: acwrHarvest.status,
        missing: acwrHarvest.missing,
        triedLoadSummary: acwrHarvest.triedLoadSummary,
        hasAcwrColumn: acwrHarvest.hasAcwrColumn,
      },
      'report_v4.acwr_harvest_incomplete'
    )
  } else if (artifactEnvelope.harvest.requireLoadDomain) {
    m.logger.info(
      {
        status: acwrHarvest.status,
        triedLoadSummary: acwrHarvest.triedLoadSummary,
        hasAcwrColumn: acwrHarvest.hasAcwrColumn,
        emptyDeclared: acwrHarvest.emptyDeclared,
      },
      acwrHarvest.emptyDeclared
        ? 'report_v4.acwr_harvest_empty_declared'
        : 'report_v4.acwr_harvest_ok'
    )
  }
  const emptyAfterTry = harvestVerification.verdicts
    .filter((row) => row.status === 'empty_after_try')
    .map((row) => (row.window ? `${row.domain}@${row.window.from}→${row.window.to}` : row.domain))
  if (emptyAfterTry.length > 0) {
    m.logger.warn({ emptyAfterTry }, 'report_v4.harvest_empty_after_try')
  }
  m.logReportV4AgentStop({
    agent: 'linker',
    stopClass: result.stopClass,
    iterations: result.iterations,
    maxIterations: result.maxIterations,
    forceAnswerAt: result.forceAnswerAt,
    profile: preserveCanvas ? 'soft' : 'full',
  })
  m.logReportV4AgentTotal({
    agent: 'linker',
    iterations: result.iterations,
    durationSec: sumSecs('linker'),
    usage: result.usage,
    detail: `datasets=${datasets}`,
  })
  state.recordAgentCost({
    agent: 'linker',
    iterations: result.iterations,
    durationSec: sumSecs('linker'),
    usage: result.usage,
    detail: `datasets=${datasets}`,
  })
}
