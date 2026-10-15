import * as m from '#services/report_v4/orchestrator/main_pipeline_bindings'
import type { PipelineState } from '#services/report_v4/orchestrator/pipeline_state'

export const runAnalystSoftSkip = (state: PipelineState): void => {
  const { ctx } = state
  const { args, framed, plan: planRaw } = ctx
  const { displayRange, clubPostes } = framed
  const { shortWindow, artifactEnvelope, softOps } = planRaw
  const { run, agentState, heatScales } = state

  if (state.recommendationStrip) {
    m.logger.info('report_v4.soft_prose_skip_analyst')
    m.stripRecommendationSectionsFromDocument(agentState.document)
  } else if (state.skipAnalystForSoftOps) {
    m.logger.info(
      {
        mode: artifactEnvelope.mode,
        vizOps: artifactEnvelope.contracts.vizOps.map((op) => op.kind),
      },
      'report_v4.soft_ops_skip_analyst'
    )
  } else {
    m.logger.info(
      {
        ops: softOps?.ops.map((op) => op.type) ?? [],
        removeQueries: softOps?.removeQueries ?? [],
        ensureToc: softOps?.ensureToc ?? false,
      },
      'report_v4.soft_editorial_skip_analyst'
    )
  }
  run.document = m.finalizeAnalystCanvas({
    document: agentState.document,
    displayRange,
    language: args.language,
    clubPostes,
    fallbackTitle: args.prompt,
    heatScales,
  })
  agentState.document = run.document
  run.reportBrief = m.synthesizeReportBriefIfMissing({
    insight: run.reportBrief,
    document: run.document,
    displayRange,
    harvestHasRows: m.harvestHasUsableDatasets(agentState),
  })
  m.logger.info(
    {
      blocks: run.document.blocks.length,
      charts: m.canvasStats(run.document).charts,
      tables: m.canvasStats(run.document).tables,
      insight: Boolean(run.reportBrief),
      iterations: 0,
      harvestHasRows: false,
      shortWindow,
      softProseOnly: state.recommendationStrip,
      softEditorialOnly: state.skipAnalystForSoftEditorial,
      softOpsOnly: state.skipAnalystForSoftOps,
    },
    'report_v4.analyst_done'
  )
}
