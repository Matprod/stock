import * as m from '#services/report_v4/orchestrator/main_pipeline_bindings'
import type { PipelineState } from '#services/report_v4/orchestrator/pipeline_state'
import { buildAnalystTools } from '#services/report_v4/orchestrator/steps/analyst_tools'
import {
  buildAnalystSystemParts,
  buildAnalystUserPrompt,
} from '#services/report_v4/orchestrator/steps/analyst_envelope'
import { postProcessAnalystResult } from '#services/report_v4/orchestrator/steps/analyst_post_process'
import { precomputeAskFacts } from '#services/report_v4/precompute_ask_facts'

export const runAnalystPass = async (state: PipelineState, envelope: string): Promise<void> => {
  const { ctx } = state
  const { args, deps: d, framed, plan: planRaw } = ctx
  const { club, softInventory, edit, preserveCanvas, needsFetch, isMicroSoft } = framed
  const {
    shortWindow,
    policy,
    domains,
    artifactEnvelope,
    priorBlockIds,
    softOps,
    softAllowBlockIds,
    harvestPlan,
    contentFloors,
  } = planRaw
  const {
    run,
    agentState,
    roster,
    analystMinIterations,
    analystMaxIterations,
    analystForceAnswerAt,
    makeDbTool,
    history,
    onIteration,
  } = state
  const priorHtml = state.priorHtml

  agentState.requestPrompt = envelope
  agentState.canvasAsk = edit.canvasAsk
  agentState.mustUseTools = true
  agentState.toolHistory = []
  const askMetrics = [
    ...new Set(
      [
        ...artifactEnvelope.harvest.requiredMetrics,
        ...(planRaw.requestedMeasure?.metric ? [planRaw.requestedMeasure.metric] : []),
      ].filter(Boolean)
    ),
  ]
  const askAthletes =
    artifactEnvelope.coverage.requiredNames.length > 0
      ? artifactEnvelope.coverage.requiredNames.map((name) => ({ name }))
      : roster.map((row) => ({ id: row.id, name: row.name }))
  if (askMetrics.length > 0 && askAthletes.length > 0) {
    const askFacts = precomputeAskFacts({
      datasets: agentState.datasets.values(),
      registry: run.facts,
      athletes: askAthletes,
      metrics: askMetrics,
      roster,
    })
    if (askFacts.added > 0) {
      m.logger.info(
        { added: askFacts.added, sample: askFacts.ids.slice(0, 8) },
        'report_v4.ask_facts_precomputed'
      )
    }
  }
  if ((policy.monitoringPlaybook && m.harvestHasUsableDatasets(agentState)) || preserveCanvas) {
    agentState.blockSql = true
  }
  const layoutRepairSoft = Boolean(preserveCanvas && softOps?.layoutRepair)
  const enrichSoft = Boolean(preserveCanvas && softOps?.enrichExistingCharts)
  const additiveSoft =
    preserveCanvas &&
    !layoutRepairSoft &&
    !enrichSoft &&
    (Boolean(softOps?.additiveSoft) ||
      (needsFetch &&
        (edit.canvasAsk.kind === m.PREMIUM_CANVAS_ASK.NEW_VIZ || edit.routeFlags.additive)))
  const softDataMutate = additiveSoft || layoutRepairSoft || enrichSoft
  if (preserveCanvas && softDataMutate) {
    agentState.blockSql = false
  }
  const keepMacros =
    !isMicroSoft &&
    needsFetch &&
    (!preserveCanvas || softDataMutate) &&
    (!m.harvestHasUsableDatasets(agentState) || shortWindow || softDataMutate)

  const tools = await buildAnalystTools({
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
    individualSheets: artifactEnvelope.coverage.individualSheets,
    requiredAthletes: artifactEnvelope.coverage.requiredNames,
    requiredMetrics: artifactEnvelope.harvest.requiredMetrics,
  })

  const priorSoftDigest = m.canvasSoftDigest(agentState.document)
  const liveContentFloors = (() => {
    if (contentFloors.mode === 'explicit' || contentFloors.mode === 'none') return contentFloors
    const verdicts = m.verifyHarvestPlan(agentState, harvestPlan).verdicts
    const withRows = new Set(
      verdicts.filter((row) => row.status === 'rows').map((row) => row.domain)
    )
    return m.resolveContentFloors({
      prompt: args.prompt,
      domainsWithDataCount: [...withRows].length,
      preserveCanvas,
    })
  })()
  const analystContinue = preserveCanvas
    ? m.softAnalystContinueForAsk({
        additive: additiveSoft,
        restoreSheets: Boolean(softOps?.restoreSheets),
        addSectionProse: Boolean(softOps?.addSectionProse),
        layoutRepair: layoutRepairSoft,
        enrichExistingCharts: Boolean(softOps?.enrichExistingCharts),
      })
    : m.REPORT_V4_ANALYST_CONTINUE
  const artifactOutline =
    softInventory?.outline?.length && preserveCanvas
      ? softInventory.outline
      : preserveCanvas && priorHtml
        ? m.buildSoftArtifactOutline(priorHtml)
        : []
  const softBlockIndex = softInventory
    ? [...softInventory.charts, ...softInventory.tables].slice(0, 48)
    : []
  const softHistory =
    preserveCanvas && (layoutRepairSoft || additiveSoft || enrichSoft || softOps?.needsAnalyst)
      ? history
      : preserveCanvas
        ? []
        : history
  const softContextPacket = preserveCanvas
    ? {
        artifactOutline,
        blockIndex: softBlockIndex,
        softOps: softOps ? m.softOpsAgentPacket(softOps) : null,
        softAllowBlockIds: softAllowBlockIds ? [...softAllowBlockIds] : null,
        softTargetsUnresolved: Boolean(softAllowBlockIds && softAllowBlockIds.size === 0),
        priorBriefTitle: run.reportBrief?.title ?? agentState.document.title ?? null,
        hasToc: softInventory?.hasToc ?? false,
        sessionFocus: args.sessionFocus ?? null,
      }
    : null
  let coverage = null as ReturnType<typeof m.evaluateCoverageGate>
  const individualSheetsFullGenerate =
    Boolean(artifactEnvelope.coverage.individualSheets) && !isMicroSoft && !preserveCanvas
  if (individualSheetsFullGenerate) {
    const rosterN = Math.max(artifactEnvelope.coverage.requiredNames.length, roster.length, 12)
    agentState.limits = {
      ...agentState.limits,
      maxBlocks: Math.max(agentState.limits?.maxBlocks ?? 0, rosterN * 8 + 24),
      maxCharts: Math.max(agentState.limits?.maxCharts ?? 0, rosterN * 2 + 8),
    }
    const prebuilt = await m.executeBuildAthleteSheets({
      state: agentState,
      roster,
      requiredAthletes: artifactEnvelope.coverage.requiredNames,
      domains,
      metrics: artifactEnvelope.harvest.requiredMetrics,
      brief: run.reportBrief,
      input: {},
    })
    let athleteCount = 0
    try {
      const parsed = JSON.parse(prebuilt) as { athletes?: string[] }
      athleteCount = Array.isArray(parsed.athletes) ? parsed.athletes.length : 0
    } catch {
      athleteCount = 0
    }
    m.logger.info(
      {
        athletes: athleteCount,
        blocks: agentState.document.blocks.length,
        maxBlocks: agentState.limits?.maxBlocks,
      },
      'report_v4.athlete_sheets_prebuilt'
    )
  }
  const systemParts = buildAnalystSystemParts({
    state,
    preserveCanvas,
    layoutRepairSoft,
    additiveSoft,
    sheetsPrebuilt: individualSheetsFullGenerate,
  })
  const result = await d.runPremiumReportAgent({
    systemStable: systemParts.systemStable,
    systemRun: systemParts.systemRun,
    userPrompt: buildAnalystUserPrompt({
      state,
      envelope,
      preserveCanvas,
      isMicroSoft,
      softContextPacket,
    }),
    history: softHistory,
    tools,
    state: agentState,
    maxIterations: analystMaxIterations,
    forceAnswerAt: analystForceAnswerAt,
    minIterations: analystMinIterations,
    maxEndTurnNudges: preserveCanvas
      ? softDataMutate ||
        edit.canvasAsk.kind === m.PREMIUM_CANVAS_ASK.NEW_VIZ ||
        edit.canvasAsk.kind === m.PREMIUM_CANVAS_ASK.RESHAPE ||
        edit.canvasAsk.kind === m.PREMIUM_CANVAS_ASK.REMOVE
        ? 4
        : 2
      : m.REPORT_V4_MAX_END_TURN_NUDGES,
    continuePrompt:
      artifactEnvelope.coverage.individualSheets &&
      artifactEnvelope.coverage.requiredNames.length > 0
        ? `${analystContinue}\n${m.coverageGateMessage(artifactEnvelope.coverage.requiredNames.length, 0, args.language)} Roster names to cover: ${artifactEnvelope.coverage.requiredNames.slice(0, 24).join(', ')}.`
        : analystContinue,
    acceptEndTurn: (s) => {
      const thin = m.rejectThinCanvas({
        preserveCanvas,
        continueMsg: analystContinue,
        floors: liveContentFloors,
        priorSoftDigest: preserveCanvas ? priorSoftDigest : undefined,
      })(s)
      if (thin) return thin
      if (coverage && !coverage.ok) {
        return m.coverageGateMessage(coverage, undefined, args.language)
      }
      if (preserveCanvas && softDataMutate && softOps) {
        const newCharts = s.document.blocks.filter(
          (b) => b.type === 'chart' && !priorBlockIds.has(b.id)
        ).length
        const newTexts = s.document.blocks.filter(
          (b) => b.type === 'text' && !priorBlockIds.has(b.id)
        ).length
        const newHeadings = s.document.blocks.filter(
          (b) => b.type === 'heading' && !priorBlockIds.has(b.id)
        ).length
        if (softOps.restoreSheets && !softOps.layoutRepair && newCharts === 0 && newHeadings < 2) {
          return `${analystContinue} Still missing individual sheets — add athlete headings + charts from datasets.`
        }
        if (softOps.addSectionProse && newTexts === 0) {
          return `${analystContinue} Still missing section captions — add_text under charts/sections.`
        }
        if (softOps.layoutRepair && m.canvasSoftDigest(s.document) === priorSoftDigest) {
          return `${analystContinue} Layout still unchanged — pair athletes to charts via update_block/remove_block.`
        }
        if (softOps.enrichExistingCharts && m.canvasSoftDigest(s.document) === priorSoftDigest) {
          return `${analystContinue} Existing charts unchanged — update_block with live datasetId on individual/focus chart ids.`
        }
      }
      if (!preserveCanvas) {
        const stats = m.canvasStats(s.document, liveContentFloors)
        const coverageGap = m.askCoverageContinue({
          domains,
          chartCount: stats.charts,
          tableCount: stats.tables,
          hasBrief: Boolean(run.reportBrief),
          floors: liveContentFloors,
        })
        if (coverageGap) return coverageGap
      }
      return m.rejectAnalystUngroundedEndTurn({
        getBrief: () => run.reportBrief,
        roster,
        allowNutritionScope: policy.allowNutritionScope,
        requireBrief: !preserveCanvas,
        clubName: club.name,
      })(s)
    },
    maxTokens: isMicroSoft ? 4096 : m.REPORT_V4_MAX_TOKENS,
    temperature: preserveCanvas ? 0.15 : m.REPORT_V4_TEMPERATURE,
    onIteration: onIteration('analyst'),
    signal: args.signal,
  })
  await postProcessAnalystResult(state, result, envelope)
}
