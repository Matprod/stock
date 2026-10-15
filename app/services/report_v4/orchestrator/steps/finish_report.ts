import * as m from '#services/report_v4/orchestrator/main_pipeline_bindings'
import type { PipelineState } from '#services/report_v4/orchestrator/pipeline_state'
import type { ReportV4OrchestratorResult } from '#services/report_v4/orchestrator/types'
import { replaceEmptyChartHostsInHtml } from '#services/report_v4/empty_block_unavailable'
import { displayPositionLabel } from '#services/report_v4/metrics/column_labels'
import { injectReportV4RunBanner } from '#services/report_v4/run_banner_html'
import { resolveReportV4RunFlags } from '#services/report_v4/run_flags'
import { syncDocumentFromFreeDesignerHtml } from '#services/report_v4/free_designer/sync_document_from_html'

const humanizeKnownPositionsInHtml = (html: string): string => {
  const known = [
    'CENTRAL DEFENDER',
    'CENTRE DEFENDER',
    'CENTER DEFENDER',
    'CENTRE BACK',
    'CENTER BACK',
    'LEFT BACK',
    'RIGHT BACK',
    'LEFT WINGER',
    'RIGHT WINGER',
    'LEFT WING',
    'RIGHT WING',
    'GOALKEEPER',
    'DEFENSIVE MIDFIELDER',
    'ATTACKING MIDFIELDER',
    'CENTRAL MIDFIELDER',
    'MIDFIELDER',
    'STRIKER',
    'FORWARD',
    'WINGER',
    'DEFENDER',
    'ATTAQUANT',
    'MILIEU',
    'DEFENSEUR',
    'GARDIEN',
  ]
  let next = html
  for (const raw of known) {
    const humanized = displayPositionLabel(raw, 'en')
    if (humanized.toLowerCase() === raw.toLowerCase()) continue
    const re = new RegExp(`\\b${raw.replace(/\s+/g, '\\s+')}\\b`, 'gi')
    next = next.replace(re, humanized)
  }
  next = next.replace(/\bSmall\s+Attaquant\b/gi, 'Forward')
  next = next.replace(/\bAttaquant\b/gi, 'Forward')
  return next
}

export const finishReport = async (state: PipelineState): Promise<ReportV4OrchestratorResult> => {
  const { ctx } = state
  const { args, coverage, framed, plan: planRaw } = ctx
  const { preserveCanvas, displayRange, domainRanges, fetchRange, rosterAll } = framed
  const { policy, route, designPack, domains, harvestFetches, artifactEnvelope, askRequirements } =
    planRaw
  const { run } = state

  let htmlArtifact = run.htmlArtifact ?? ''
  if (m.artifactHtmlLooksValid(htmlArtifact)) {
    const insightRoster = await m.resolveInsightRosterPhotos({
      roster: rosterAll,
      athleteNames: m.collectInsightAthleteNames(run.reportBrief),
    })
    const signed = m.applySignedPhotosInHtml(htmlArtifact, insightRoster)
    htmlArtifact = signed.html
    if (signed.applied > 0) {
      m.logger.info({ applied: signed.applied }, 'report_v4.insight_photos_signed')
    }
    const nutritionStrip = m.stripNutritionProseFromHtml(htmlArtifact, policy.allowNutritionScope)
    htmlArtifact = nutritionStrip.html
    if (nutritionStrip.stripped > 0) {
      m.logger.warn(
        { stripped: nutritionStrip.stripped },
        'report_v4.grounding_strip_nutrition_html'
      )
    }
  }

  const flags = resolveReportV4RunFlags({ language: args.language, html: htmlArtifact })
  if (m.artifactHtmlLooksValid(htmlArtifact)) {
    const emptied = replaceEmptyChartHostsInHtml(htmlArtifact, args.language)
    htmlArtifact = emptied.html
    if (emptied.replaced > 0) {
      m.logger.info({ replaced: emptied.replaced }, 'report_v4.empty_chart_hosts_replaced')
    }
    htmlArtifact = humanizeKnownPositionsInHtml(htmlArtifact)
    htmlArtifact = injectReportV4RunBanner(htmlArtifact, { runId: state.runId, flags })
  }
  run.htmlArtifact = htmlArtifact
  if (/data-artifact=["']free-designer["']/i.test(htmlArtifact)) {
    const beforeBlocks = run.document.blocks.length
    run.document = syncDocumentFromFreeDesignerHtml(run.document, htmlArtifact)
    m.logger.info(
      {
        beforeBlocks,
        afterBlocks: run.document.blocks.length,
      },
      'report_v4.free_designer_canvas_synced'
    )
  }
  if (state.harvestDataProfile) {
    const reliability = m.ensureDataReliabilityBlocks(
      run.document,
      state.harvestDataProfile,
      args.language,
      state.imputedMarkSummary
    )
    run.document = reliability.document
    if (reliability.inserted) {
      m.logger.info(
        {
          blocks: run.document.blocks.length,
          sampleRows: state.harvestDataProfile.datasets.reduce((sum, row) => sum + row.rowCount, 0),
          imputedExcludedCells: state.imputedMarkSummary?.excludedCellCount ?? 0,
        },
        'report_v4.data_reliability_block'
      )
    }
  }
  if (m.artifactHtmlLooksValid(htmlArtifact) && run.document.blocks.length > 0) {
    const parity = m.evaluateArtifactParity(run.document, htmlArtifact)
    m.logger.info(
      {
        ok: parity.ok,
        issues: parity.issues.slice(0, 12),
        documentBlockCount: parity.documentBlockCount,
        htmlBlockCount: parity.htmlBlockCount,
      },
      'report_v4.artifact_parity'
    )
    if (!parity.ok && /data-artifact=["']free-designer["']/i.test(htmlArtifact)) {
      run.document = syncDocumentFromFreeDesignerHtml(run.document, htmlArtifact)
      const retried = m.evaluateArtifactParity(run.document, htmlArtifact)
      m.logger.info(
        {
          ok: retried.ok,
          documentBlockCount: retried.documentBlockCount,
          htmlBlockCount: retried.htmlBlockCount,
        },
        'report_v4.artifact_parity_after_sync'
      )
    }
  }

  const measureGate = m.enforceRequestedMeasure({
    measure: planRaw.requestedMeasure,
    document: run.document,
    brief: run.reportBrief,
    datasets: state.agentState.datasets.values(),
    language: args.language,
  })
  run.document = measureGate.document
  if (measureGate.brief) run.reportBrief = measureGate.brief
  if (measureGate.status !== 'skipped' && measureGate.status !== 'ok') {
    m.logger.info(
      {
        status: measureGate.status,
        metric: planRaw.requestedMeasure?.metric,
        unit: planRaw.requestedMeasure?.unit,
        displayedUnit: measureGate.displayedUnit,
        phase: 'finish',
      },
      'report_v4.requested_measure_gate'
    )
  }

  const askContract = m.verifyAskContract({
    requirements: askRequirements,
    document: run.document,
    envelope: artifactEnvelope,
    acwrStatus: state.acwrHarvestStatus,
    language: args.language,
    htmlArtifact,
  })
  m.logger.info(
    {
      status: askContract.status,
      gaps: askContract.results
        .filter((row) => row.status !== 'delivered')
        .map((row) => ({ id: row.id, status: row.status })),
    },
    'report_v4.ask_contract'
  )

  if (run.templateRecoveredReason) {
    state.softEditPath = 'template_recovered'
    const templateRefusal = m.refusalFromTemplateRecovered({
      reason: run.templateRecoveredReason,
      language: args.language,
    })
    state.softRefusals = [...state.softRefusals, templateRefusal]
    state.softCoachMessage =
      state.softCoachMessage ??
      m.formatSoftEditPathMessage({
        path: 'template_recovered',
        language: args.language,
        detail: templateRefusal.reason,
      })
  } else if (!state.softEditPath) {
    state.softEditPath = 'full_rebuild'
  }

  let message = state.softCoachMessage
  if (!message && preserveCanvas && state.softBlocked.includes('zero_mutations')) {
    message = m.formatSoftEditPathMessage({ path: 'unchanged', language: args.language })
  }
  if (!message && (state.softEditPath === 'local' || state.softEditPath === 'full_rebuild')) {
    message = m.formatSoftEditPathMessage({
      path: state.softEditPath,
      language: args.language,
      detail: askContract.message,
    })
  }
  if (!message) {
    message = askContract.message
  }

  const nextSessionFocus =
    domains.length > 0 || harvestFetches.length > 0
      ? m.buildSessionFocus({
          prompt: args.prompt,
          domains: domains.length ? domains : harvestFetches.map((row) => row.domain),
          fetches: harvestFetches,
          displayRange,
        })
      : (args.sessionFocus ?? null)

  const summary = m.buildSoftRunSummary({
    envelope: artifactEnvelope,
    softApplied: state.softApplied,
    softBlocked: state.softBlocked,
    coverage: state.coverageGateResult,
    acwrStatus: state.acwrHarvestStatus,
    pathCostClass: state.pathCostClass,
    language: args.language === 'en' ? 'en' : 'fr',
    askContract,
    editPath: state.softEditPath,
    refusals: state.softRefusals,
  })

  state.journal.push({
    at: new Date().toISOString(),
    level: 'info',
    message: 'finish_report',
    data: {
      flags,
      pathCostClass: state.pathCostClass,
      askContractStatus: askContract.status,
      htmlBytes: htmlArtifact.length,
    },
  })

  const datasets = [...state.agentState.datasets.values()]
  const facts = [...run.facts.values()]

  return {
    document: run.document,
    message,
    iterations: run.iterations,
    usage: run.usage,
    iterationSecs: run.iterationSecs,
    iterationCosts: run.iterationCosts,
    html: run.htmlArtifact ?? '',
    designPack,
    route,
    sessionFocus: nextSessionFocus,
    coverage: {
      displayRange,
      fetchRange,
      domainRanges,
      domains: coverage.domains,
      populatedDomains: coverage.populatedDomains,
      emptyDomains: coverage.emptyDomains,
    },
    clarify: null,
    summary,
    pathCostClass: state.pathCostClass,
    runId: state.runId,
    flags,
    brief: run.reportBrief,
    facts,
    datasets,
    profile: state.harvestDataProfile,
    agentCosts: state.agentCosts,
    journal: state.journal,
  }
}
