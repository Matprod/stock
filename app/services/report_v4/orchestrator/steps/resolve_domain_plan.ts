import logger from '@adonisjs/core/services/logger'
import { PREMIUM_DOMAIN } from '#constants/premium_report_domains'
import {
  clonePremiumDocument,
  emptyPremiumDocument,
  sanitizeIncomingDocument,
} from '#services/premium_report/premium_report_document'
import { resolveSoftBlockTargets } from '#services/report_v4/orchestrator/steps/domain_plan_soft'
import type { ArtifactEnvelope } from '#services/report_v4/artifact_runtime/index'
import { resolveReportDomains } from '#services/report_v4/ask_domain_resolve'
import type { CoachPromptPolicy } from '#services/report_v4/coach_prompt_policy'
import {
  applyDomainExclusions,
  applyDomainPreferences,
} from '#services/report_v4/coach_prompt_policy'
import {
  buildAskRequirements,
  resolveContentFloors,
  type AskRequirement,
  type ContentFloors,
  type RequestedMeasure,
} from '#services/report_v4/request/ask_contract'
import { resolveReportDesignPack } from '#services/report_v4/design/report_design_pack'
import { buildHarvestPlan } from '#services/report_v4/harvest_plan'
import { athletesMentionedInPrompt } from '#services/report_v4/metrics/athlete_split'
import type { MainPipelineContext } from '#services/report_v4/orchestrator/types'
import {
  REPORT_V4_SHORT_WINDOW_DAYS,
  windowDayCount,
} from '#services/report_v4/report_v4_constants'
import { skippedReportV4Route, type ReportV4Route } from '#services/report_v4/report_v4_router'
import type { SoftEditOpsPlan } from '#services/report_v4/soft_edit_ops'
import type { PremiumReportDocument } from '#contracts/premium_report'
import type { ReportDesignPack } from '#services/report_v4/design/report_design_pack'
import type { PremiumDomain } from '#constants/premium_report_domains'

export type DomainPlan = {
  daySpan: number
  shortWindow: boolean
  policy: CoachPromptPolicy
  route: ReportV4Route
  designPack: ReportDesignPack
  domains: PremiumDomain[]
  useShortDepth: boolean
  harvestFetches: Array<{ domain: PremiumDomain; from: string; to: string }>
  harvestPlan: ReturnType<typeof buildHarvestPlan>
  namedAthletes: string[]
  artifactEnvelope: ArtifactEnvelope
  askRequirements: AskRequirement[]
  requestedMeasure: RequestedMeasure | null
  contentFloors: ContentFloors
  document: PremiumReportDocument
  priorBlockIds: Set<string>
  priorDocumentForSoft: PremiumReportDocument | null
  softOps: SoftEditOpsPlan | null
  softEditorialOnly: boolean
  softAllowBlockIds: Set<string> | undefined
}

export type DomainPlanFull = DomainPlan & {
  softTargetsUnresolved: boolean
  softTargetCandidates: Array<{ title: string }>
}

export const buildDomainPlan = async (ctx: MainPipelineContext): Promise<DomainPlanFull> => {
  const { args, deps: d, coverage } = ctx
  const {
    designPackFromPrompt,
    designPackExplicit,
    askDomains,
    multiSectionAsk,
    earlyFetchDomains,
    inheritedFocusDomains,
    edit,
    preserveCanvas,
    needsFetch,
    isMicroSoft,
    displayRange,
    domainRanges,
    fetchWindows,
    fetchRange,
    rosterAll,
  } = ctx.framed

  const daySpanResolved = windowDayCount(displayRange.from, displayRange.to)
  if (daySpanResolved === null) {
    logger.warn({ from: displayRange.from, to: displayRange.to }, 'report_v4.invalid_display_range')
  }
  const daySpan = daySpanResolved ?? 0
  const shortWindow = daySpanResolved !== null && daySpanResolved <= REPORT_V4_SHORT_WINDOW_DAYS
  let policy = await d.resolveCoachPromptPolicy(args.prompt, args.language)
  if (!policy.preferredDomains.length && needsFetch) {
    const seedDomains =
      inheritedFocusDomains.length > 0
        ? inheritedFocusDomains
        : earlyFetchDomains.length > 0
          ? earlyFetchDomains
          : (args.sessionFocus?.domains ?? [])
    if (seedDomains.length > 0) {
      policy = {
        ...policy,
        preferredDomains: [...seedDomains],
        monitoringPlaybookReason: `session_focus=${seedDomains.join(',')};${policy.monitoringPlaybookReason}`,
      }
    }
  }
  const populatedForRoute = applyDomainPreferences(
    applyDomainExclusions(coverage.populatedDomains, policy.excludedDomains),
    policy.preferredDomains
  )
  const route = isMicroSoft
    ? {
        ...skippedReportV4Route(designPackFromPrompt.id),
        domains: populatedForRoute,
        includePhotos: false,
        analysisDepth: 'standard' as const,
        provider: 'skip' as const,
      }
    : await d.routeReportV4({
        prompt: args.prompt,
        populatedDomains: populatedForRoute,
        designPackId: designPackFromPrompt.id,
        askDomains,
        preferredDomains: policy.preferredDomains,
      })
  const designPack = designPackExplicit
    ? designPackFromPrompt
    : resolveReportDesignPack(route.designPackId)
  if (designPackExplicit && route.designPackId !== designPack.id) {
    route.designPackId = designPack.id
  }
  const domainResolve = isMicroSoft
    ? {
        domains: [] as PremiumDomain[],
        fromAsk: [] as PremiumDomain[],
        fromWindows: [] as PremiumDomain[],
        fromPreferred: [] as PremiumDomain[],
        forcedArchive: [] as PremiumDomain[],
        dropped: [] as Array<{ domain: PremiumDomain; reason: string }>,
      }
    : resolveReportDomains({
        prompt: args.prompt,
        preferred: policy.preferredDomains,
        routed: route.domains,
        populated: populatedForRoute,
        excluded: policy.excludedDomains,
        fetches: fetchWindows,
        monitoringPlaybook: policy.monitoringPlaybook,
        askDomains,
      })
  let domains = [...domainResolve.domains]
  if (!isMicroSoft && domains.length === 0 && edit.softOps?.restoreSheets) {
    domains = [PREMIUM_DOMAIN.SCORES]
    logger.info({ forced: domains }, 'report_v4.soft_restore_domains_forced')
  }
  const useShortDepth =
    shortWindow && !policy.monitoringPlaybook && !multiSectionAsk && domains.length < 3
  const harvestFetches = [
    ...fetchWindows.filter((row) => domains.includes(row.domain)),
    ...domains
      .filter((domain) => !fetchWindows.some((row) => row.domain === domain))
      .map((domain) => ({
        domain,
        from: domainRanges[domain]?.from ?? displayRange.from,
        to: domainRanges[domain]?.to ?? displayRange.to,
      })),
  ]
  let harvestPlan = buildHarvestPlan(domains, {
    fetches: harvestFetches,
    loadLookback: fetchRange,
  })
  const scopeAthletes = rosterAll.map((row) => ({
    id: row.id,
    name: row.name,
    position: row.position || null,
  }))
  const namedAthleteIds = athletesMentionedInPrompt(args.prompt, scopeAthletes)
  const namedAthletes = namedAthleteIds
    .map((id) => scopeAthletes.find((row) => row.id === id)?.name)
    .filter((name): name is string => Boolean(name))
  const artifactEnvelope: ArtifactEnvelope = await d.resolveArtifactEnvelopeAsync({
    prompt: args.prompt,
    rosterNames: rosterAll.map((row) => row.name),
    namedAthletes,
    language: args.language,
    reportShape: policy.reportShape,
  })
  if (artifactEnvelope.harvest.requireLoadDomain && !domains.includes(PREMIUM_DOMAIN.LOAD)) {
    domains.push(PREMIUM_DOMAIN.LOAD)
    harvestPlan = buildHarvestPlan(domains, {
      fetches: [
        ...harvestFetches,
        {
          domain: PREMIUM_DOMAIN.LOAD,
          from: domainRanges.load?.from ?? displayRange.from,
          to: domainRanges.load?.to ?? displayRange.to,
        },
      ],
      loadLookback: fetchRange,
    })
  }
  if (
    !isMicroSoft &&
    (!useShortDepth || multiSectionAsk) &&
    (policy.monitoringPlaybook ||
      policy.reportShape === 'individual_focus' ||
      multiSectionAsk ||
      domains.length >= 3)
  ) {
    route.analysisDepth = 'deep'
  }
  const document =
    preserveCanvas && args.document
      ? sanitizeIncomingDocument(args.document, displayRange, args.language)
      : emptyPremiumDocument(displayRange, [])
  document.dateRange = { from: displayRange.from, to: displayRange.to }
  const priorBlockIds = new Set(document.blocks.map((block) => block.id))
  const priorDocumentForSoft = preserveCanvas ? clonePremiumDocument(document) : null
  const softOps = edit.softOps
  const softEditorialOnly = Boolean(preserveCanvas && softOps?.editorialOnly)
  const { softAllowBlockIds, softTargetsUnresolved, softTargetCandidates } =
    resolveSoftBlockTargets({
      prompt: args.prompt,
      preserveCanvas,
      needsFetch,
      softOps,
      softEditorialOnly,
      edit,
      document,
      askDomains,
    })

  const domainsWithData = domains.filter((domain) => populatedForRoute.includes(domain))
  const contentFloors = resolveContentFloors({
    prompt: args.prompt,
    domainsWithDataCount: domainsWithData.length,
    preserveCanvas,
  })
  const askRequirements = buildAskRequirements({
    displayRange,
    policy,
    envelope: artifactEnvelope,
    domains,
    contentFloors,
  })

  return {
    daySpan,
    shortWindow,
    policy,
    route,
    designPack,
    domains,
    useShortDepth,
    harvestFetches,
    harvestPlan,
    namedAthletes,
    artifactEnvelope,
    askRequirements,
    requestedMeasure: null,
    contentFloors,
    document,
    priorBlockIds,
    priorDocumentForSoft,
    softOps,
    softEditorialOnly,
    softAllowBlockIds,
    softTargetsUnresolved,
    softTargetCandidates,
  }
}
