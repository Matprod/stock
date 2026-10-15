import type { MainPipelineContext, ReportV4OrchestratorResult } from '#services/report_v4/orchestrator/types'
import { initPipelineState } from '#services/report_v4/orchestrator/pipeline_state'
import { collectData } from '#services/report_v4/orchestrator/steps/collect_data'
import { analyzeBrief } from '#services/report_v4/orchestrator/steps/analyze_brief'
import { editLocal } from '#services/report_v4/orchestrator/steps/edit_local'
import { composeArtifact } from '#services/report_v4/orchestrator/steps/compose_artifact'
import { finishReport } from '#services/report_v4/orchestrator/steps/finish_report'
import { withStepTimeout } from '#services/report_v4/step_timeout'
import logger from '@adonisjs/core/services/logger'
import { formatRunTimingLine } from '#services/report_v4/run_journal'

export const runMainPipeline = async (
  ctx: MainPipelineContext
): Promise<ReportV4OrchestratorResult> => {
  const { progress, framed } = ctx
  const timings: Array<{ step: string; durationSec: number }> = []
  const timed = async <T>(step: string, ms: number, fn: () => Promise<T>): Promise<T> => {
    const started = Date.now()
    try {
      return await withStepTimeout({ step, timeoutMs: ms, run: fn })
    } finally {
      timings.push({ step, durationSec: Number(((Date.now() - started) / 1000).toFixed(3)) })
    }
  }

  progress('understand_request', 'understand_request')
  const state = await timed('init', 60_000, () => initPipelineState(ctx))

  if (framed.preserveCanvas && !framed.needsFetch) {
    progress('apply_edit', 'apply_edit')
    await timed('edit_local', 180_000, () => editLocal(state))
    const result = await timed('finish', 60_000, () => finishReport(state))
    logger.info({ timingLine: formatRunTimingLine(state.agentCosts, timings) }, 'report_v4.run_timing')
    return result
  }

  progress('collect_data', 'collect_data')
  await timed('collect', 300_000, () => collectData(state))
  progress('analyze', 'analyze')
  await timed('analyze', 420_000, () => analyzeBrief(state))
  progress('build_sheets', 'build_sheets')
  await timed('edit_local', 180_000, () => editLocal(state))
  progress('design_pages', 'design_pages')
  await timed('compose', 540_000, () => composeArtifact(state))
  const result = await timed('finish', 60_000, () => finishReport(state))
  logger.info({ timingLine: formatRunTimingLine(state.agentCosts, timings) }, 'report_v4.run_timing')
  return result
}
