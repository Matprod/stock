import { Exception } from '@adonisjs/core/exceptions'
import type { PremiumAgentResult } from '#services/premium_report/premium_report_agent_types'
import * as m from '#services/report_v4/orchestrator/main_pipeline_bindings'
import type { PipelineState } from '#services/report_v4/orchestrator/pipeline_state'
import { runAnalystRecovery } from '#services/report_v4/orchestrator/steps/analyst_recovery'

export const postProcessAnalystResult = async (
  state: PipelineState,
  result: PremiumAgentResult,
  envelope: string
): Promise<void> => {
  const { ctx, agentState, run, sumSecs, heatScales } = state
  const { args, framed, plan: planRaw } = ctx
  const { multiSectionAsk, preserveCanvas, displayRange, clubPostes } = framed
  const { policy, domains, artifactEnvelope, shortWindow, harvestPlan, contentFloors } = planRaw

  m.addUsage(run.usage, result.usage)
  run.iterations += result.iterations
  const analystUsage = { ...result.usage }
  let analystIterations = result.iterations

  m.logReportV4AgentStop({
    agent: 'analyst',
    stopClass: result.stopClass,
    iterations: result.iterations,
    maxIterations: result.maxIterations,
    forceAnswerAt: result.forceAnswerAt,
    profile: preserveCanvas ? 'soft' : 'full',
  })

  const recovery = await runAnalystRecovery(state, envelope)
  if (recovery) {
    m.addUsage(analystUsage, recovery.usage)
    analystIterations += recovery.iterations
  }

  run.document = m.finalizeAnalystCanvas({
    document: agentState.document,
    displayRange,
    language: args.language,
    clubPostes,
    fallbackTitle: args.prompt,
    heatScales,
    maxBlocks: agentState.limits?.maxBlocks,
  })
  const strippedNutrition = m.stripNutritionProseFromDocument(
    run.document,
    policy.allowNutritionScope
  )
  const strippedViz = m.stripUngroundedVizBlocks(run.document)
  const realignedProse = m.realignCrossedSectionProse(run.document)
  if (strippedNutrition > 0 || strippedViz.strippedIds.length > 0 || realignedProse > 0) {
    m.logger.warn(
      {
        nutritionBlocks: strippedNutrition,
        ungroundedViz: strippedViz.strippedIds,
        realignedProse,
      },
      'report_v4.grounding_strip_after_analyst'
    )
  }
  run.document = m.heatStaffTablesInDocument(run.document, args.language, heatScales)
  const emptyDomains = [
    ...new Set([
      ...(state.harvestDataProfile?.emptyDomains ?? []).map(String),
      ...m
        .verifyHarvestPlan(agentState, harvestPlan)
        .verdicts.filter((row) => row.status === 'empty_after_try')
        .map((row) => String(row.domain)),
    ]),
  ]
  const missingDomains = m.ensureMissingDomainNotices({
    document: run.document,
    domains,
    emptyDomains,
  })
  run.document = missingDomains.document
  if (missingDomains.inserted.length > 0) {
    m.logger.info({ domains: missingDomains.inserted }, 'report_v4.missing_domain_notice')
  }
  agentState.document = run.document
  run.reportBrief = m.synthesizeReportBriefIfMissing({
    insight: run.reportBrief,
    document: run.document,
    displayRange,
    harvestHasRows: m.harvestHasUsableDatasets(agentState),
  })
  if (!preserveCanvas && m.harvestHasUsableDatasets(agentState) && !run.reportBrief) {
    m.logger.warn(
      { title: run.document.title },
      'report_v4.report_brief_unavailable_after_synthesize'
    )
  }
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
  const coverageGap = !preserveCanvas
    ? m.askCoverageContinue({
        domains,
        chartCount: m.canvasStats(run.document, liveContentFloors).charts,
        tableCount: m.canvasStats(run.document, liveContentFloors).tables,
        hasBrief: Boolean(run.reportBrief),
        floors: liveContentFloors,
      })
    : null
  if (coverageGap) {
    m.logger.warn({ coverageGap, domains }, 'report_v4.ask_coverage_incomplete')
  }
  const coverage = m.evaluateCoverageGate(run.document, artifactEnvelope)
  state.coverageGateResult = coverage
  if (coverage) {
    m.logger.info(
      {
        required: coverage.required,
        delivered: coverage.delivered,
        missing: coverage.missing,
        mode: artifactEnvelope.mode,
      },
      'report_v4.coverage_gate'
    )
    if (!coverage.ok) {
      const nextBrief = m.annotateBriefCoverageShortfall(
        run.reportBrief,
        coverage,
        args.language === 'en' ? 'en' : 'fr'
      )
      if (nextBrief) run.reportBrief = nextBrief
      else {
        m.logger.warn(
          { shortfall: `${coverage.delivered}/${coverage.required}` },
          'report_v4.coverage_gate_no_brief'
        )
      }
      if (artifactEnvelope.coverage.individualSheets) {
        throw new Exception(
          m.coverageGateMessage(coverage, undefined, args.language === 'en' ? 'en' : 'fr'),
          { status: 422 }
        )
      }
    }
  }

  const measureGate = m.enforceRequestedMeasure({
    measure: planRaw.requestedMeasure,
    document: run.document,
    brief: run.reportBrief,
    datasets: agentState.datasets.values(),
    language: args.language,
  })
  run.document = measureGate.document
  agentState.document = run.document
  if (measureGate.brief) run.reportBrief = measureGate.brief
  if (measureGate.status !== 'skipped' && measureGate.status !== 'ok') {
    m.logger.info(
      {
        status: measureGate.status,
        metric: planRaw.requestedMeasure?.metric,
        unit: planRaw.requestedMeasure?.unit,
        displayedUnit: measureGate.displayedUnit,
        phase: 'pre_designer',
      },
      'report_v4.requested_measure_gate'
    )
  }

  const canvasFacts = m.precomputeCanvasFacts({
    datasets: agentState.datasets.values(),
    registry: run.facts,
    document: run.document,
  })
  if (canvasFacts.added > 0) {
    m.logger.info(
      { added: canvasFacts.added, sample: canvasFacts.ids.slice(0, 8) },
      'report_v4.canvas_facts_precomputed'
    )
  }

  const finalStats = m.canvasStats(run.document)
  const analystTotal = {
    agent: 'analyst',
    iterations: analystIterations,
    durationSec: Number((sumSecs('analyst') + sumSecs('analyst_recovery')).toFixed(3)),
    usage: analystUsage,
    detail: `blocks=${run.document.blocks.length} charts=${finalStats.charts} tables=${finalStats.tables} insight=${Boolean(run.reportBrief)}`,
  }
  m.logReportV4AgentTotal(analystTotal)
  state.recordAgentCost(analystTotal)
  m.logger.info(
    {
      blocks: run.document.blocks.length,
      charts: finalStats.charts,
      tables: finalStats.tables,
      insight: Boolean(run.reportBrief),
      iterations: analystIterations,
      harvestHasRows: m.harvestHasUsableDatasets(agentState),
      shortWindow,
      multiSectionAsk,
    },
    'report_v4.analyst_done'
  )
}
