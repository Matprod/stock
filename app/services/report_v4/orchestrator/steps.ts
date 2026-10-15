import type { ReportV4OrchestratorDeps } from '#services/report_v4/orchestrator/deps'
import { probeCoverage } from '#services/report_v4/orchestrator/steps/probe_coverage'
import { resolveDomains } from '#services/report_v4/orchestrator/steps/resolve_domains'
import type {
  CoverageProbeResult,
  FramedAsk,
  MainPipelineContext,
  ReportV4OrchestratorArgs,
  ReportV4OrchestratorResult,
} from '#services/report_v4/orchestrator/types'
import type { ResolveDomainsResult } from '#services/report_v4/orchestrator/steps/resolve_domains'
import {
  resolveReportRequest,
  type ResolvedReportRequest,
} from '#services/report_v4/request/resolve_request'

export type { MainPipelineContext }

export type ReportV4OrchestratorSteps = {
  resolveReportRequest: (
    args: ReportV4OrchestratorArgs,
    deps: ReportV4OrchestratorDeps
  ) => Promise<ResolvedReportRequest>
  frameAsk: (
    args: ReportV4OrchestratorArgs,
    deps: ReportV4OrchestratorDeps
  ) => Promise<FramedAsk>
  probeCoverage: (
    args: ReportV4OrchestratorArgs,
    framed: FramedAsk,
    deps: ReportV4OrchestratorDeps
  ) => Promise<CoverageProbeResult>
  resolveDomains: (ctx: MainPipelineContext) => Promise<ResolveDomainsResult>
  runMainPipeline: (ctx: MainPipelineContext) => Promise<ReportV4OrchestratorResult>
}

export const defaultOrchestratorSteps = (
  runMainPipeline: ReportV4OrchestratorSteps['runMainPipeline']
): ReportV4OrchestratorSteps => ({
  resolveReportRequest,
  frameAsk: async (args, deps) => (await resolveReportRequest(args, deps)).framed,
  probeCoverage,
  resolveDomains,
  runMainPipeline,
})
