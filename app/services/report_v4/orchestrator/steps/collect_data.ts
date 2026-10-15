import * as m from '#services/report_v4/orchestrator/main_pipeline_bindings'
import type { PipelineState } from '#services/report_v4/orchestrator/pipeline_state'
import { runLinkerAgent } from '#services/report_v4/orchestrator/steps/collect_linker'

export const collectData = async (state: PipelineState): Promise<void> => {
  const { ctx } = state
  const { args, framed, plan: planRaw } = ctx
  const { edit, preserveCanvas, displayRange } = framed
  const { artifactEnvelope, softOps, softEditorialOnly } = planRaw
  const { agentState, run, subjectiveScalesForProfiler } = state

  await runLinkerAgent(state)

  state.softProseOnly = preserveCanvas && Boolean(state.priorHtml) && edit.routeFlags.partialProse
  state.recommendationStrip = state.softProseOnly && edit.routeFlags.recommendationStrip
  state.skipAnalystForSoftEditorial =
    softEditorialOnly && Boolean(state.priorHtml) && artifactEnvelope.contracts.softAllowed
  state.skipAnalystForSoftOps =
    preserveCanvas &&
    Boolean(state.priorHtml) &&
    artifactEnvelope.mode === 'soft_ops' &&
    artifactEnvelope.contracts.softAllowed &&
    !softOps?.needsFetch &&
    !softOps?.restoreSheets &&
    !softOps?.layoutRepair &&
    !softOps?.enrichExistingCharts &&
    !softOps?.additiveSoft
  state.skipAnalystForSoftPath = state.skipAnalystForSoftEditorial || state.skipAnalystForSoftOps
  state.pathCostClass = m.resolvePathCostClass({
    envelope: artifactEnvelope,
    preserveCanvas,
    softEditorialOnly,
    skipAnalyst: state.skipAnalystForSoftPath,
    needsFetch: framed.needsFetch,
  })
  m.logger.info(
    { pathCostClass: state.pathCostClass, budgetUsd: m.pathCostBudgetUsd(state.pathCostClass) },
    'report_v4.path_cost_class'
  )

  if (
    preserveCanvas &&
    state.priorHtml &&
    softOps &&
    softOps.needsAnalyst &&
    softOps.removeQueries.length > 0
  ) {
    const earlyOps = {
      ...softOps,
      ensureToc: false,
      ops: softOps.ops.filter(
        (op) => op.type === 'remove_section' || op.type === 'strip_empty_sections'
      ),
    }
    const early = m.applyResolvedSoftEditorial({
      html: state.priorHtml,
      document: agentState.document,
      ops: earlyOps,
      language: args.language,
      clubName: framed.club.name,
      reportTitle: agentState.document.title,
    })
    state.priorHtml = early.html
    agentState.document = early.document
    run.document = early.document
    state.softEditorialAppliedEarly = true
    m.logger.info(
      {
        removedSections: early.removed.length,
        droppedBlockIds: early.droppedBlockIds,
        gates: early.gates,
      },
      'report_v4.soft_editorial_early_remove'
    )
  }

  state.harvestDataProfile = null
  state.imputedMarkSummary = null
  if (agentState.datasets.size > 0) {
    state.harvestDataProfile = m.profileHarvestDatasets({
      datasets: agentState.datasets.values(),
      window: displayRange,
      sqlRowCapHint: m.PREMIUM_REPORT_SQL_MAX_ROWS,
      subjectiveScales: subjectiveScalesForProfiler,
    })
    state.imputedMarkSummary = m.markImputedCells({
      datasets: agentState.datasets.values(),
      subjectiveScales: subjectiveScalesForProfiler,
    })
    m.logger.info(
      {
        datasets: state.harvestDataProfile.datasets.length,
        unusableDomains: state.harvestDataProfile.unusableDomains,
        emptyDomains: state.harvestDataProfile.emptyDomains,
        partial: state.harvestDataProfile.domains
          .filter((row) => row.verdict === 'partial')
          .map((row) => row.domain),
        imputedExcludedCells: state.imputedMarkSummary.excludedCellCount,
      },
      'report_v4.data_profile'
    )
  }

  state.dataProfileHint = state.harvestDataProfile
    ? m.formatDataProfileAnalystHint(state.harvestDataProfile)
    : undefined
  state.dataProfilePacket = state.harvestDataProfile
    ? m.compactDataProfileForLlm(state.harvestDataProfile)
    : null
}
