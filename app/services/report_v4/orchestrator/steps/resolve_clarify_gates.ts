import logger from '@adonisjs/core/services/logger'
import { emptyUsage } from '#services/premium_report/premium_report_agent'
import { buildSoftRunSummary } from '#services/report_v4/artifact_runtime/index'
import type { MainPipelineContext } from '#services/report_v4/orchestrator/types'
import { withAskRound } from '#services/report_v4/session_focus'
import type { DomainPlanFull } from '#services/report_v4/orchestrator/steps/resolve_domain_plan'
import type { ResolveDomainsResult } from '#services/report_v4/orchestrator/steps/resolve_domains'

export const checkClarifyGates = async (
  ctx: MainPipelineContext,
  full: DomainPlanFull
): Promise<ResolveDomainsResult | null> => {
  const { args, deps: d, progress, coverage } = ctx
  const { displayRange, fetchRange, domainRanges, priorHtml } = ctx.framed
  const { document, domains, route, designPack, artifactEnvelope, softTargetsUnresolved, softTargetCandidates } = full

  const softClarify = d.resolveSoftClarify({
    prompt: args.prompt,
    envelope: artifactEnvelope,
    preserveCanvas: ctx.framed.preserveCanvas,
    softTargetsUnresolved,
    candidateTitles: softTargetCandidates.map((row) => row.title),
    softOps: full.softOps,
    language: args.language,
  })
  if (softClarify.needsClarify) {
    const softAskFocus = withAskRound(args.sessionFocus, {
      prompt: args.prompt,
      displayRange,
      domains: domains.length ? domains : ctx.framed.askDomains,
      questionIds: softClarify.questions.map((q) => q.id),
    })
    logger.info(
      {
        confidence: softClarify.confidence,
        reason: softClarify.reason,
        question_ids: softClarify.questions.map((q) => q.id),
        round: softAskFocus.askRound ?? 1,
        mode: artifactEnvelope.mode,
      },
      'report_v4.ask_gate'
    )
    progress(softClarify.markdown, softClarify.markdown)
    return {
      kind: 'clarify',
      result: {
        document,
        message: softClarify.markdown,
        iterations: 0,
        usage: emptyUsage(),
        iterationSecs: [],
        iterationCosts: [],
        html: priorHtml ?? '',
        designPack,
        route,
        sessionFocus: softAskFocus,
        coverage: {
          displayRange,
          fetchRange,
          domainRanges,
          domains: coverage.domains,
          populatedDomains: coverage.populatedDomains,
          emptyDomains: coverage.emptyDomains,
        },
        clarify: softClarify,
        summary: buildSoftRunSummary({
          envelope: artifactEnvelope,
          softApplied: [],
          softBlocked: ['clarify'],
          clarified: true,
          pathCostClass: 'editorial',
        }),
        pathCostClass: 'editorial',
      },
    }
  }

  const freshAsk = d.resolveFreshClarify({
    language: args.language,
    preserveCanvas: ctx.framed.preserveCanvas,
    askRound: args.sessionFocus?.askRound ?? 0,
    explicitPeriod: ctx.framed.explicitPeriod,
    askDomains: ctx.framed.askDomains,
    preferredDomains: full.policy.preferredDomains,
  })
  logger.info(
    {
      reason: freshAsk.needsClarify ? freshAsk.reason : freshAsk.skipReason,
      question_ids: freshAsk.questions.map((q) => q.id),
      confidence: freshAsk.confidence,
      round: args.sessionFocus?.askRound ?? 0,
      skipped: freshAsk.skipped,
    },
    'report_v4.ask_gate'
  )
  if (freshAsk.needsClarify) {
    const askFocus = withAskRound(args.sessionFocus, {
      prompt: args.prompt,
      displayRange,
      domains: domains.length ? domains : ctx.framed.askDomains,
      questionIds: freshAsk.questions.map((q) => q.id),
    })
    progress(freshAsk.markdown, freshAsk.markdown)
    return {
      kind: 'clarify',
      result: {
        document,
        message: freshAsk.markdown,
        iterations: 0,
        usage: emptyUsage(),
        iterationSecs: [],
        iterationCosts: [],
        html: priorHtml ?? '',
        designPack,
        route,
        sessionFocus: askFocus,
        coverage: {
          displayRange,
          fetchRange,
          domainRanges,
          domains: coverage.domains,
          populatedDomains: coverage.populatedDomains,
          emptyDomains: coverage.emptyDomains,
        },
        clarify: freshAsk,
        summary: null,
        pathCostClass: 'editorial',
      },
    }
  }

  return null
}
