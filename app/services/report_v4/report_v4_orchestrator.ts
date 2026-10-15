import { throwIfAborted } from '#services/report_v4/request_abort'
import {
  defaultOrchestratorDeps,
  type ReportV4OrchestratorDeps,
} from '#services/report_v4/orchestrator/deps'
import {
  defaultOrchestratorSteps,
  type ReportV4OrchestratorSteps,
} from '#services/report_v4/orchestrator/steps'
import { runMainPipeline } from '#services/report_v4/orchestrator/steps/run_main_pipeline'
import type {
  ReportV4OrchestratorArgs,
  ReportV4OrchestratorResult,
} from '#services/report_v4/orchestrator/types'

export type { ReportV4OrchestratorResult } from '#services/report_v4/orchestrator/types'

export const runReportV4Orchestrator = async (
  args: ReportV4OrchestratorArgs,
  depsPartial: Partial<ReportV4OrchestratorDeps> = {},
  stepsPartial: Partial<ReportV4OrchestratorSteps> = {}
): Promise<ReportV4OrchestratorResult> => {
  const d: ReportV4OrchestratorDeps = { ...defaultOrchestratorDeps(), ...depsPartial }
  const steps = defaultOrchestratorSteps(runMainPipeline)
  Object.assign(steps, stepsPartial)
  const progress = (fr: string, en: string) => {
    if (fr === en && /^[a-z][a-z0-9_]*$/.test(fr)) {
      args.onProgress?.(fr)
      return
    }
    args.onProgress?.(args.language === 'fr' ? fr : en)
  }
  throwIfAborted(args.signal)
  const resolvedRequest = await steps.resolveReportRequest(args, d)
  const framed = resolvedRequest.framed
  const probed = await steps.probeCoverage(args, framed, d)
  if (probed.kind === 'empty') return probed.result
  const pipelineCtx = {
    args,
    deps: d,
    framed: probed.framed,
    coverage: probed.coverage,
        progress,
  }
  const resolved = await steps.resolveDomains(pipelineCtx)
  if (resolved.kind === 'clarify') return resolved.result
  return steps.runMainPipeline({
    ...pipelineCtx,
    plan: resolved.plan,
  })
}
