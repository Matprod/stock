import type { MainPipelineContext, ReportV4OrchestratorResult } from '#services/report_v4/orchestrator/types'
import { buildDomainPlan } from '#services/report_v4/orchestrator/steps/resolve_domain_plan'
import { checkClarifyGates } from '#services/report_v4/orchestrator/steps/resolve_clarify_gates'

export type { DomainPlan } from '#services/report_v4/orchestrator/steps/resolve_domain_plan'

export type ResolveDomainsResult =
  | { kind: 'continue'; plan: import('#services/report_v4/orchestrator/steps/resolve_domain_plan').DomainPlan }
  | { kind: 'clarify'; result: ReportV4OrchestratorResult }

export const resolveDomains = async (
  ctx: MainPipelineContext
): Promise<ResolveDomainsResult> => {
  const full = await buildDomainPlan(ctx)
  const clarify = await checkClarifyGates(ctx, full)
  if (clarify) return clarify
  return { kind: 'continue', plan: full }
}
