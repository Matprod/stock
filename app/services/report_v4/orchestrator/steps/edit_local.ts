import * as m from '#services/report_v4/orchestrator/main_pipeline_bindings'
import type { PipelineState } from '#services/report_v4/orchestrator/pipeline_state'
import type {  } from '#services/report_v4/orchestrator/types'

export const editLocal = async (state: PipelineState): Promise<void> => {
  const { ctx } = state
  const { args, deps: d, progress, framed, plan: planRaw } = ctx
  const {
    club, edit, preserveCanvas,     priorChartCount,       } = framed
  let priorHtml = state.priorHtml
  let needsFreshArtifact = state.needsFreshArtifact
  let softRebindRepair = state.softRebindRepair
  let softEditorialAppliedEarly = state.softEditorialAppliedEarly
  const {
    designPack,     artifactEnvelope, priorBlockIds, priorDocumentForSoft,
    softOps, softEditorialOnly, softAllowBlockIds,
  } = planRaw
  const {
    run, agentState, heatScales,               } = state
  let softApplied = state.softApplied
  let softBlocked = state.softBlocked
  let softCoachMessage = state.softCoachMessage
  let softEditPath = state.softEditPath
  let softRefusals = state.softRefusals
  let coverageGateResult = state.coverageGateResult
  let acwrHarvestStatus = state.acwrHarvestStatus
  let harvestDataProfile = state.harvestDataProfile
  let softProseOnly = state.softProseOnly
  let recommendationStrip = state.recommendationStrip
  let skipAnalystForSoftEditorial = state.skipAnalystForSoftEditorial
  let skipAnalystForSoftOps = state.skipAnalystForSoftOps
  let skipAnalystForSoftPath = state.skipAnalystForSoftPath
  let pathCostClass = state.pathCostClass

    let charts = m.collectArtifactCharts(agentState.document, heatScales)
    let chartCount = charts.length

    const softPathAllowed =
      preserveCanvas &&
      Boolean(priorHtml) &&
      artifactEnvelope.contracts.softAllowed &&
      artifactEnvelope.mode !== 'gated_rebuild'

    if (preserveCanvas && priorHtml && !softPathAllowed) {
      needsFreshArtifact = true
      run.htmlArtifact = null
      m.logger.info(
        {
          mode: artifactEnvelope.mode,
          softAllowed: artifactEnvelope.contracts.softAllowed,
          preserveCanvas: true,
        },
        'report_v4.soft_path_skipped_gated_rebuild'
      )
    }

    if (softPathAllowed && priorHtml) {
      const softPrep = m.prepareSoftArtifactPath({
        document: agentState.document,
        envelope: artifactEnvelope,
        softOps,
        softEditorialOnly,
      })
      if (softPrep.opResult.patched > 0) {
        agentState.document = softPrep.document
        run.document = softPrep.document
      }
      const soft = d.runSoftRebind({
        priorHtml,
        document: softPrep.document,
        priorDocument: priorDocumentForSoft,
        priorBlockIds,
        priorChartCount,
        softOps: softPrep.softOps,
        designOps: softPrep.designOps,
        softProseOnly: Boolean(softProseOnly),
        softEditorialOnly: softPrep.softEditorialOnly,
        softEditorialAppliedEarly,
        recommendationStrip: Boolean(recommendationStrip),
        canvasAskKind: edit.canvasAsk.kind,
        heatScales: heatScales ?? [],
        designPack,
        language: args.language,
        clubName: club.name,
        progress,
        facts: run.facts,
      })
      agentState.document = soft.document
      run.document = soft.document
      run.htmlArtifact = soft.htmlArtifact
        ? m.refreshArtifactPresentationCss(soft.htmlArtifact, designPack)
        : soft.htmlArtifact
      softRebindRepair = soft.softRebindRepair
      needsFreshArtifact = soft.needsFreshArtifact
      softApplied = soft.softApplied
      softBlocked = soft.softBlocked
      softRefusals = soft.refusals
      if (soft.coachMessage) softCoachMessage = soft.coachMessage
      if (!soft.restoredPrior) {
        softEditPath = 'local'
      } else if (soft.refusals.some((row) => row.code === 'soft_truth_escalate')) {
        softEditPath = 'local_refused'
      } else if (softBlocked.includes('zero_mutations')) {
        softEditPath = 'unchanged'
      } else {
        softEditPath = 'local_refused'
      }
      if (priorDocumentForSoft && softAllowBlockIds && !soft.restoredPrior) {
        const diff = m.evaluateSoftDiffGate({
          prior: priorDocumentForSoft,
          next: soft.document,
          allowBlockIds: softAllowBlockIds,
        })
        if (diff && !diff.ok) {
          softBlocked = [
            ...softBlocked,
            'diff_gate',
            ...(diff.orderChanged ? ['diff_order'] : []),
            ...diff.documentFieldsChanged.map((field) => `diff_doc:${field}`),
          ]
          softRebindRepair = false
          needsFreshArtifact = false
          run.document = m.clonePremiumDocument(priorDocumentForSoft)
          agentState.document = run.document
          run.htmlArtifact = priorHtml
            ? m.refreshArtifactPresentationCss(priorHtml, designPack)
            : priorHtml
          softEditPath = 'local_refused'
          softRefusals = m.refusalFromDiffGate({
            mutatedOutsideAllowlist: diff.mutatedOutsideAllowlist,
            orderChanged: diff.orderChanged,
            documentFieldsChanged: diff.documentFieldsChanged,
            language: args.language,
          })
          softCoachMessage = m.formatSoftEditPathMessage({
            path: 'local_refused',
            language: args.language,
            detail:
              args.language === 'fr'
                ? "Je n'ai pas pu appliquer la modification localement (hors périmètre). Le rapport précédent a été conservé. Voulez-vous que je refasse le rapport ?"
                : 'I could not apply the change locally (outside the allowed scope). The previous report was kept. Should I rebuild the report?',
          })
          m.logger.warn(
            {
              mutatedOutsideAllowlist: diff.mutatedOutsideAllowlist,
              orderChanged: diff.orderChanged,
              documentFieldsChanged: diff.documentFieldsChanged,
              checkedOutside: diff.checkedOutside,
              restoredPrior: true,
              refusals: softRefusals,
            },
            'report_v4.soft_diff_gate'
          )
        }
      }
      charts = m.collectArtifactCharts(agentState.document, heatScales)
      chartCount = charts.length
    }


  state.charts = charts
  state.chartCount = chartCount

  state.priorHtml = priorHtml
  state.needsFreshArtifact = needsFreshArtifact
  state.softRebindRepair = softRebindRepair
  state.softEditorialAppliedEarly = softEditorialAppliedEarly
  state.softApplied = softApplied
  state.softBlocked = softBlocked
  state.softCoachMessage = softCoachMessage
  state.softEditPath = softEditPath
  state.softRefusals = softRefusals
  state.coverageGateResult = coverageGateResult
  state.acwrHarvestStatus = acwrHarvestStatus
  state.harvestDataProfile = harvestDataProfile
  state.softProseOnly = softProseOnly
  state.recommendationStrip = recommendationStrip
  state.skipAnalystForSoftEditorial = skipAnalystForSoftEditorial
  state.skipAnalystForSoftOps = skipAnalystForSoftOps
  state.skipAnalystForSoftPath = skipAnalystForSoftPath
  state.pathCostClass = pathCostClass

}
