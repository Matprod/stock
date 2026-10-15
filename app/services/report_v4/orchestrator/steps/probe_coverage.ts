import logger from '@adonisjs/core/services/logger'
import { Exception } from '@adonisjs/core/exceptions'
import { emptyUsage } from '#services/premium_report/premium_report_agent'
import { emptyPremiumDocument } from '#services/premium_report/premium_report_document'
import type { ReportV4OrchestratorDeps } from '#services/report_v4/orchestrator/deps'
import type {
  CoverageProbeResult,
  FramedAsk,
  ReportV4OrchestratorArgs,
} from '#services/report_v4/orchestrator/types'
import { skippedReportV4Route } from '#services/report_v4/report_v4_router'

export const probeCoverage = async (
  args: ReportV4OrchestratorArgs,
  framed: FramedAsk,
  d: ReportV4OrchestratorDeps
): Promise<CoverageProbeResult> => {
  const {
    club,
    designPackFromPrompt,
    isMicroSoft,
    displayRange,
    domainRanges,
    fetchWindows,
    fetchRange,
    athleteIds,
  } = framed

  if (isMicroSoft) {
    return {
      kind: 'continue',
      framed,
      coverage: {
        dateRange: displayRange,
        domains: [],
        populatedDomains: [],
        emptyDomains: [],
      },
    }
  }

  const resolved = await d.resolveFullCoverage({
    clubId: args.clubId,
    prompt: args.prompt,
    athleteIds,
    displayRange,
    domainRanges,
    fetches: fetchWindows,
  })
  const coverage = {
    dateRange: resolved.displayRange,
    domains: resolved.domains,
    populatedDomains: resolved.populatedDomains,
    emptyDomains: resolved.emptyDomains,
  }

  if (coverage.populatedDomains.length === 0) {
    const empty = emptyPremiumDocument(displayRange, [])
    const message = `For ${displayRange.from} → ${displayRange.to}, no populated domain.`
    logger.info(
      {
        reason: 'empty_coverage_short_circuit',
        displayRange,
        emptyDomains: coverage.emptyDomains,
      },
      'report_v4.designer_fallback_template'
    )
    const finalized = d.finalizeMinimalEmptyArtifact({
      clubName: club.name,
      title: args.language === 'fr' ? 'Rapport staff' : 'Staff report',
      message,
      dateRange: displayRange,
      pack: designPackFromPrompt,
      language: args.language,
    })
    if (!finalized.ok) {
      throw new Exception(`Empty coverage artifact failed: ${finalized.error}`, { status: 500 })
    }
    return {
      kind: 'empty',
      result: {
        document: empty,
        message,
        iterations: 0,
        usage: emptyUsage(),
        iterationSecs: [],
        iterationCosts: [],
        html: finalized.html,
        designPack: designPackFromPrompt,
        route: skippedReportV4Route(designPackFromPrompt.id),
        sessionFocus: args.sessionFocus ?? null,
        coverage: {
          displayRange,
          fetchRange,
          domainRanges,
          domains: coverage.domains,
          populatedDomains: [],
          emptyDomains: coverage.emptyDomains,
        },
      },
    }
  }

  return { kind: 'continue', framed, coverage }
}
