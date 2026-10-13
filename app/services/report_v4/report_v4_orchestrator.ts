import logger from '@adonisjs/core/services/logger'
import {
  PREMIUM_CANVAS_ASK,
  PREMIUM_REPORT_HISTORY_MAX,
  PREMIUM_REPORT_SQL_MAX_BYTES,
  PREMIUM_REPORT_SQL_MAX_ROWS,
} from '#constants/premium_report.constants'
import type { PremiumAgentIterationEvent } from '#services/premium_report/premium_report_agent'
import {
  PREMIUM_DOMAIN,
  schemaTitlesForDomains,
  type PremiumDomain,
} from '#constants/premium_report_domains'
import {
  clubMetricCatalog,
  resolveClubMetricCatalogRange,
} from '#services/premium_report/club_metric_catalog'
import { formatRpeProbeBrief, probeRpeSources } from '#services/premium_report/rpe_source_probe'
import type { AgentContext } from '#contracts/agent'
import type {
  PremiumReportDocument,
  PremiumReportDocumentDraft,
  PremiumReportHistoryTurn,
} from '#contracts/premium_report'
import { createDbTool } from '#services/agent_db_tool'
import { formulaCatalogForLlm } from '#services/report_v4/metrics/formula_llm'
import { athletesMentionedInPrompt } from '#services/report_v4/metrics/athlete_split'
import {
  clonePremiumDocument,
  compactPremiumDocument,
  emptyPremiumDocument,
  sanitizeIncomingDocument,
} from '#services/premium_report/premium_report_document'
import { emptyUsage, runPremiumReportAgent } from '#services/premium_report/premium_report_agent'
import { throwIfAborted } from '#services/report_v4/request_abort'
import { createPremiumDataTools, allowedFormulaIds } from '#services/premium_report/tools_data'
import { createPremiumMacroTools } from '#services/premium_report/tools_macros'
import { createPremiumDocumentTools } from '#services/premium_report/tools_document'
import {
  listSoftTargetCandidates,
  resolveSoftEditTargets,
} from '#services/premium_report/soft_edit_targets'
import {
  wrapQueryTool,
  type PremiumReportState,
} from '#services/premium_report/premium_report_tools'
import {
  type PremiumReportTokenUsage,
} from '#services/premium_report/premium_report_log'
import {
  REPORT_V4_ANALYST_CONTINUE,
  REPORT_V4_ANALYST_FORCE_ANSWER_AT,
  REPORT_V4_ANALYST_FORCE_ANSWER_AT_SHORT,
  REPORT_V4_ANALYST_MAX_ITERATIONS,
  REPORT_V4_ANALYST_MAX_ITERATIONS_SHORT,
  REPORT_V4_ANALYST_MIN_ITERATIONS,
  REPORT_V4_ANALYST_MIN_ITERATIONS_DEEP,
  REPORT_V4_ANALYST_MIN_ITERATIONS_SHORT,
  REPORT_V4_ANALYST_RECOVERY_CONTINUE,
  REPORT_V4_ANALYST_RECOVERY_MAX_ITERATIONS,
  softAnalystContinueForAsk,
  REPORT_V4_DESIGNER_CONTINUE,
  REPORT_V4_DESIGNER_FORCE_ANSWER_AT,
  REPORT_V4_DESIGNER_MAX_ITERATIONS,
  REPORT_V4_DESIGNER_MAX_TOKENS,
  REPORT_V4_DESIGNER_MIN_ITERATIONS,
  REPORT_V4_LEAN_WINDOW_DAYS,
  REPORT_V4_LINKER_CONTINUE,
  REPORT_V4_LINKER_FORCE_ANSWER_AT,
  REPORT_V4_LINKER_FORCE_ANSWER_AT_SHORT,
  REPORT_V4_LINKER_MAX_ITERATIONS,
  REPORT_V4_LINKER_MAX_ITERATIONS_SHORT,
  REPORT_V4_LINKER_MAX_TOKENS_SHORT,
  REPORT_V4_LINKER_MIN_ITERATIONS,
  REPORT_V4_LINKER_MIN_ITERATIONS_SHORT,
  REPORT_V4_MAX_BLOCKS,
  REPORT_V4_MAX_CHARTS,
  REPORT_V4_MAX_END_TURN_NUDGES,
  REPORT_V4_MAX_TOKENS,
  REPORT_V4_SHORT_WINDOW_DAYS,
  REPORT_V4_SOFT_ANALYST_ADDITIVE_FORCE_ANSWER_AT,
  REPORT_V4_SOFT_ANALYST_ADDITIVE_MAX_ITERATIONS,
  REPORT_V4_SOFT_ANALYST_FORCE_ANSWER_AT,
  REPORT_V4_SOFT_ANALYST_MAX_ITERATIONS,
  REPORT_V4_SOFT_ANALYST_MIN_ITERATIONS,
  REPORT_V4_SOFT_LINKER_FORCE_ANSWER_AT,
  REPORT_V4_SOFT_LINKER_MAX_ITERATIONS,
  REPORT_V4_SOFT_LINKER_MIN_ITERATIONS,
  REPORT_V4_TEMPERATURE,
  windowDayCount,
} from '#services/report_v4/report_v4_constants'
import {
  buildAnalystSystemPrompt,
  buildDesignerSystemPrompt,
  buildLinkerSystemPrompt,
  buildSoftAnalystSystemPrompt,
} from '#services/report_v4/agents/agent_prompts'
import {
  createDesignerTools,
  createReportBriefTools,
  formatClubSubjectiveScalesBrief,
  projectHeatScalesFromCatalogue,
  projectSubjectiveScalesForProfiler,
  projectWellnessScalesForDesigner,
  renderDesignerTemplateArtifact,
} from '#services/report_v4/agents/stage_tools'
import { createReportFactTools } from '#services/report_v4/agents/fact_tools'
import { SubjectiveScaleService } from '#services/subjective_scale_service'
import { createWellnessSleepMacroTools } from '#services/report_v4/wellness_sleep_macros'
import {
  applySignedPhotosInHtml,
  collectInsightAthleteNames,
  createRosterMacroTool,
  loadClubRoster,
  resolveInsightRosterPhotos,
} from '#services/report_v4/roster_macros'
import { clubPositionCatalog } from '#services/report_v4/position_catalog'
import {
  routeReportV4,
  skippedReportV4Route,
  type ReportV4Route,
} from '#services/report_v4/report_v4_router'
import {
  artifactHtmlLooksValid,
  collectArtifactCharts,
  collectArtifactTables,
  countPresentChartHosts,
  finalizeMinimalEmptyArtifact,
  freeArtifactTooThinForCharts,
  refreshArtifactPresentationCss,
  stripRecommendationSectionsFromDocument,
} from '#services/report_v4/artifact_html'
import { evaluateAskContract } from '#services/report_v4/ask_contract'
import { evaluateArtifactParity } from '#services/report_v4/artifact_parity'
import { runSoftRebind } from '#services/report_v4/soft_rebind'
import {
  formatSoftEditPathMessage,
  refusalFromDiffGate,
  refusalFromTemplateRecovered,
  type SoftEditPath,
  type SoftRefusal,
} from '#services/report_v4/soft_refusal'
import {
  acwrHarvestNudge,
  analystIterationBudget,
  analystPacketFromEnvelope,
  annotateBriefCoverageShortfall,
  buildSoftRunSummary,
  coverageGateMessage,
  evaluateCoverageGate,
  evaluateSoftDiffGate,
  prepareSoftArtifactPath,
  resolveArtifactEnvelopeAsync,
  pathCostBudgetUsd,
  resolvePathCostClass,
  resolveFreshClarify,
  resolveSoftClarify,
  verifyAcwrHarvest,
  type ArtifactEnvelope,
  type SoftClarifyResult,
  type SoftRunSummary,
} from '#services/report_v4/artifact_runtime/index'
import { buildSoftArtifactOutline } from '#services/report_v4/artifact_sections'
import { resolveReportEditPlan } from '#services/report_v4/edit_route'
import {
  buildSoftCanvasInventory,
  softOpsAgentPacket,
} from '#services/report_v4/soft_canvas_inventory'
import { applyResolvedSoftEditorial } from '#services/report_v4/soft_edit_ops'

import {
  resolveDesignPackFromPrompt,
  resolveReportDesignPack,
  type ReportDesignPack,
} from '#services/report_v4/design/report_design_pack'
import {
  resolveFullCoverage,
  type DomainCoverageReport,
} from '#services/report_v4/domain_coverage_probe'
import { askCoverageContinue, resolveReportDomains } from '#services/report_v4/ask_domain_resolve'
import { analyzeRequest } from '#services/report_v4/analyze_request'
import {
  acceptLinkerHarvestEndTurn,
  buildHarvestPlan,
  harvestHasUsableDatasets,
  verifyHarvestPlan,
} from '#services/report_v4/harvest_plan'
import {
  addUsage,
  canvasSoftDigest,
  canvasStats,
  catalogDatasets,
  finalizeAnalystCanvas,
  formatTimeRangeBrief,
  heatStaffTablesInDocument,
  rejectThinCanvas,
  synthesizeReportBriefIfMissing,
  type ReportV4RunState,
} from '#services/report_v4/orchestrator_helpers'
import {
  realignCrossedSectionProse,
  rejectAnalystUngroundedEndTurn,
  stripNutritionProseFromDocument,
  stripNutritionProseFromHtml,
  stripUngroundedVizBlocks,
} from '#services/report_v4/grounding_auditor'
import { buildFetchRange } from '#services/report_v4/lookback_range'
import {
  applyDomainExclusions,
  applyDomainPreferences,
  resolveCoachPromptPolicy,
} from '#services/report_v4/coach_prompt_policy'
import {
  compactDataProfileForLlm,
  formatDataProfileAnalystHint,
  profileHarvestDatasets,
  type HarvestDataProfile,
} from '#services/report_v4/data_profiler'
import { ensureDataReliabilityBlocks } from '#services/report_v4/data_reliability'
import {
  formatClubInsightScienceAnalystHint,
  loadClubInsightScience,
  type ClubInsightScience,
} from '#services/report_v4/club_insight_science'
import {
  COACH_REPORT_SHAPE,
} from '#services/report_v4/coach_policy_heuristic'
import { formatClubSeasonsBrief, loadClubSeasons } from '#services/report_v4/club_seasons'
import { ensureTimeSeriesDomainWindows, unionCoverRange } from '#services/report_v4/prompt_scope'
import {
  logReportV4AgentTotal,
  logReportV4Banner,
  logReportV4Iteration,
} from '#services/report_v4/report_v4_log'
import {
  buildSessionFocus,
  priorUserAsks,
  withAskRound,
  type ReportV4SessionFocus,
} from '#services/report_v4/session_focus'
import type { AppLanguage } from '#utils/localize'
import Club from '#models_pg/club'
import { Exception } from '@adonisjs/core/exceptions'

export type ReportV4OrchestratorResult = {
  document: PremiumReportDocument
  message: string
  iterations: number
  usage: PremiumReportTokenUsage
  iterationSecs: number[]
  iterationCosts: number[]
  html: string
  designPack: ReportDesignPack
  route: ReportV4Route
  sessionFocus: ReportV4SessionFocus | null
  coverage: {
    displayRange: { from: string; to: string }
    fetchRange: { from: string; to: string }
    domainRanges: Partial<Record<PremiumDomain, { from: string; to: string }>>
    domains: DomainCoverageReport['domains']
    populatedDomains: string[]
    emptyDomains: string[]
  }
  clarify?: SoftClarifyResult | null
  summary?: SoftRunSummary | null
  pathCostClass?: string
}

export const runReportV4Orchestrator = async (args: {
  clubId: string
  prompt: string
  language: AppLanguage
  history?: PremiumReportHistoryTurn[]
  sessionFocus?: ReportV4SessionFocus
  document?: PremiumReportDocumentDraft
  html?: string
  designPackId?: string
  onProgress?: (message: string) => void
  signal?: AbortSignal
}): Promise<ReportV4OrchestratorResult> => {
  const progress = (fr: string, en: string) => {
    args.onProgress?.(args.language === 'fr' ? fr : en)
  }
  throwIfAborted(args.signal)
  const club = await Club.find(args.clubId)
  if (!club) throw new Exception('Club not found', { status: 404 })

  const { pack: designPackFromPrompt, explicit: designPackExplicit } = resolveDesignPackFromPrompt(
    args.prompt,
    args.designPackId
  )
  const clubSeasons = await loadClubSeasons(args.clubId)
  const clubSeasonsBrief = formatClubSeasonsBrief(clubSeasons)
  const priorAsks = priorUserAsks(args.history, 2)
  const analyzed = await analyzeRequest(args.prompt, {
    seasons: clubSeasons,
    sessionFocus: args.sessionFocus,
    priorUserAsks: priorAsks,
  })
  const askDomains = analyzed.askDomains
  const periodFollowUp = analyzed.periodFollowUp
  const promptWindows = analyzed.windows
  const multiSectionAsk = analyzed.multiSection
  const promptedRange = promptWindows.display
  const explicitPeriod = promptWindows.explicit
  const priorRange = args.document?.dateRange
  const periodChanged =
    explicitPeriod &&
    Boolean(priorRange) &&
    (priorRange!.from !== promptedRange.from || priorRange!.to !== promptedRange.to)
  const hasBlocks = Boolean(args.document?.blocks?.length)
  const earlyFetchDomains = [
    ...new Set(promptWindows.fetches.map((row) => row.domain)),
  ] as PremiumDomain[]
  const inheritedFocusDomains =
    askDomains.length === 0 &&
    args.sessionFocus?.domains.length &&
    (periodFollowUp || earlyFetchDomains.length > 0)
      ? args.sessionFocus.domains
      : []
  const softInventory =
    hasBlocks || (typeof args.html === 'string' && args.html.length > 0)
      ? buildSoftCanvasInventory({
          document: args.document ?? null,
          html: typeof args.html === 'string' ? args.html : null,
        })
      : null
  const edit = await resolveReportEditPlan({
    prompt: args.prompt,
    hasExistingCanvas: hasBlocks,
    periodChanged,
    multiSectionAsk,
    inventory: softInventory,
    sessionFocus: args.sessionFocus,
    windowFetchDomains: earlyFetchDomains,
    askDomains,
  })
  const preserveCanvas = edit.preserveCanvas
  const needsFetch = edit.needsFetch
  const isMicroSoft = edit.isMicro
  let priorHtml =
    preserveCanvas && typeof args.html === 'string' && artifactHtmlLooksValid(args.html)
      ? args.html
      : null
  let needsFreshArtifact = !preserveCanvas || !priorHtml
  let softRebindRepair = false
  let softEditorialAppliedEarly = false
  const priorChartCount = preserveCanvas
    ? (args.document?.blocks ?? []).filter((b) => b.type === 'chart').length
    : 0
  const displayRange =
    preserveCanvas && priorRange && (!explicitPeriod || edit.keepPriorDisplayRange)
      ? { from: priorRange.from, to: priorRange.to }
      : promptedRange
  const hasLiveWindowFetches = promptWindows.fetches.length > 0
  const softKeepPriorWindow =
    preserveCanvas && !explicitPeriod && !hasLiveWindowFetches && !needsFetch
  const promptedDomainWindows = softKeepPriorWindow
    ? {}
    : Object.keys(promptWindows.byDomain).length > 0 ||
        !preserveCanvas ||
        edit.keepPriorDisplayRange ||
        explicitPeriod ||
        hasLiveWindowFetches
      ? promptWindows.byDomain
      : {}
  const domainRanges = ensureTimeSeriesDomainWindows(
    args.prompt,
    displayRange,
    promptedDomainWindows
  )
  const rawFetchWindows =
    promptWindows.fetches.length > 0
      ? promptWindows.fetches
      : Object.entries(domainRanges).flatMap(([domain, range]) =>
          range ? [{ domain: domain as PremiumDomain, from: range.from, to: range.to }] : []
        )
  const fetchWindows = softKeepPriorWindow
    ? rawFetchWindows.map((row) => ({
        ...row,
        from: displayRange.from,
        to: displayRange.to,
      }))
    : rawFetchWindows
  const coverRange = unionCoverRange(displayRange, domainRanges, promptWindows.extraRanges)
  // ACWR lookback from display/load only — do not pull Dec biomarkers into every macro fetch.
  const fetchRange = buildFetchRange(domainRanges.load ?? displayRange, {
    ewmaWindowDays: 28,
  })
  const timeRangesBrief = formatTimeRangeBrief({
    displayRange,
    coverRange,
    fetchRange,
    domainRanges,
    fetches: fetchWindows,
    extraRanges: promptWindows.extraRanges,
    clubSeasonsBrief,
  })
  logger.info(
    {
      explicit: explicitPeriod,
      displayRange,
      coverRange,
      fetchRange,
      domainRanges,
      fetches: fetchWindows,
      extraRanges: promptWindows.extraRanges,
      seasons: clubSeasons.map((row) => ({
        name: row.name,
        from: row.from,
        to: row.to,
        active: row.active,
      })),
    },
    'report_v4.prompt_windows_resolved'
  )
  if (!explicitPeriod) {
    logger.warn(
      { displayRange, promptPreview: args.prompt.slice(0, 180) },
      'report_v4.display_range_fallback'
    )
  }
  const rosterActiveRanges = [
    displayRange,
    ...fetchWindows.map((row) => ({ from: row.from, to: row.to })),
  ]
  const rosterAll = await loadClubRoster(args.clubId, { activeRanges: rosterActiveRanges })
  logger.info(
    {
      athletes: rosterAll.length,
      ranges: rosterActiveRanges,
    },
    'report_v4.roster_active_window'
  )
  const clubPostes = clubPositionCatalog(rosterAll)
  const athleteIds = rosterAll.map((row) => row.id)

  let coverage: DomainCoverageReport
  if (isMicroSoft) {
    coverage = {
      dateRange: displayRange,
      domains: [],
      populatedDomains: [],
      emptyDomains: [],
    }
  } else {
    const resolved = await resolveFullCoverage({
      clubId: args.clubId,
      prompt: args.prompt,
      athleteIds,
      displayRange,
      domainRanges,
      fetches: fetchWindows,
    })
    coverage = {
      dateRange: resolved.displayRange,
      domains: resolved.domains,
      populatedDomains: resolved.populatedDomains,
      emptyDomains: resolved.emptyDomains,
    }
  }

  if (!isMicroSoft && coverage.populatedDomains.length === 0) {
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
    const finalized = finalizeMinimalEmptyArtifact({
      clubName: club.name,
      title: 'Staff report',
      message,
      dateRange: displayRange,
      pack: designPackFromPrompt,
      language: args.language,
    })
    if (!finalized.ok) {
      throw new Exception(`Empty coverage artifact failed: ${finalized.error}`, { status: 500 })
    }
    return {
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
    }
  }

  const daySpan = windowDayCount(displayRange.from, displayRange.to)
  const shortWindow = daySpan <= REPORT_V4_SHORT_WINDOW_DAYS
  let policy = await resolveCoachPromptPolicy(args.prompt, args.language)
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
    : await routeReportV4({
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
  const artifactEnvelope: ArtifactEnvelope = await resolveArtifactEnvelopeAsync({
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
  const softUnlockAllowlist =
    Boolean(softOps?.layoutRepair) ||
    Boolean(softOps?.enrichExistingCharts) ||
    (edit.canvasAsk.kind === PREMIUM_CANVAS_ASK.RESHAPE && needsFetch)
  const softAllowlistKind =
    edit.canvasAsk.kind === PREMIUM_CANVAS_ASK.MICRO_EDIT ||
    edit.canvasAsk.kind === PREMIUM_CANVAS_ASK.RESHAPE ||
    edit.canvasAsk.kind === PREMIUM_CANVAS_ASK.REMOVE
  const softTargetIds =
    preserveCanvas && !softEditorialOnly
      ? resolveSoftEditTargets(args.prompt, document, { askDomains })
      : []
  const softAllowBlockIds = preserveCanvas
    ? softUnlockAllowlist || softEditorialOnly
      ? new Set(document.blocks.map((block) => block.id))
      : softAllowlistKind
        ? new Set(softTargetIds)
        : new Set(document.blocks.map((block) => block.id))
    : undefined
  const softTargetsUnresolved = Boolean(
    preserveCanvas &&
      !softEditorialOnly &&
      !softUnlockAllowlist &&
      softAllowlistKind &&
      softAllowBlockIds &&
      softAllowBlockIds.size === 0
  )
  const softTargetCandidates = softTargetsUnresolved
    ? listSoftTargetCandidates(args.prompt, document, 8, { askDomains })
    : []
  if (softTargetsUnresolved) {
    logger.warn(
      {
        canvasAsk: edit.canvasAsk.kind,
        blockCount: document.blocks.length,
        promptPreview: args.prompt.slice(0, 160),
        candidates: softTargetCandidates.map((row) => row.title),
        failClosed: false,
      },
      'soft_targets_unresolved'
    )
  }

  const softClarify = resolveSoftClarify({
    prompt: args.prompt,
    envelope: artifactEnvelope,
    preserveCanvas,
    softTargetsUnresolved,
    candidateTitles: softTargetCandidates.map((row) => row.title),
    softOps,
    language: args.language,
  })
  if (softClarify.needsClarify) {
    const softAskFocus = withAskRound(args.sessionFocus, {
      prompt: args.prompt,
      displayRange,
      domains: domains.length ? domains : askDomains,
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
    }
  }

  const freshAsk = resolveFreshClarify({
    language: args.language,
    preserveCanvas,
    askRound: args.sessionFocus?.askRound ?? 0,
    explicitPeriod,
    askDomains,
    preferredDomains: policy.preferredDomains,
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
      domains: domains.length ? domains : askDomains,
      questionIds: freshAsk.questions.map((q) => q.id),
    })
    progress(freshAsk.markdown, freshAsk.markdown)
    return {
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
    }
  }

  const roster = rosterAll.map((row) => ({ ...row, photoUrl: null }))
  route.includePhotos = false
  const athletes = roster.map((row) => ({ id: row.id, name: row.name }))
  let analystMinIterations = REPORT_V4_ANALYST_MIN_ITERATIONS
  if (preserveCanvas) {
    analystMinIterations = needsFetch ? 2 : REPORT_V4_SOFT_ANALYST_MIN_ITERATIONS
  } else if (
    route.analysisDepth === 'deep' ||
    daySpan > REPORT_V4_LEAN_WINDOW_DAYS ||
    policy.monitoringPlaybook
  ) {
    analystMinIterations = REPORT_V4_ANALYST_MIN_ITERATIONS_DEEP
  } else if (useShortDepth) {
    analystMinIterations = REPORT_V4_ANALYST_MIN_ITERATIONS_SHORT
  }
  let analystMaxIterations = preserveCanvas
    ? needsFetch
      ? REPORT_V4_SOFT_ANALYST_ADDITIVE_MAX_ITERATIONS
      : REPORT_V4_SOFT_ANALYST_MAX_ITERATIONS
    : useShortDepth
      ? REPORT_V4_ANALYST_MAX_ITERATIONS_SHORT
      : REPORT_V4_ANALYST_MAX_ITERATIONS
  let analystForceAnswerAt = preserveCanvas
    ? needsFetch
      ? REPORT_V4_SOFT_ANALYST_ADDITIVE_FORCE_ANSWER_AT
      : REPORT_V4_SOFT_ANALYST_FORCE_ANSWER_AT
    : useShortDepth
      ? REPORT_V4_ANALYST_FORCE_ANSWER_AT_SHORT
      : REPORT_V4_ANALYST_FORCE_ANSWER_AT
  {
    const budget = analystIterationBudget({
      envelope: artifactEnvelope,
      base: {
        min: analystMinIterations,
        max: analystMaxIterations,
        forceAnswerAt: analystForceAnswerAt,
      },
    })
    analystMinIterations = budget.min
    analystMaxIterations = budget.max
    analystForceAnswerAt = budget.forceAnswerAt
  }

  const subjectiveScales = new SubjectiveScaleService()
  const wellnessCatalogue = await subjectiveScales.getClubCatalogue(args.clubId, args.language)
  const heatScales = projectHeatScalesFromCatalogue(wellnessCatalogue)
  const subjectiveScalesLine = formatClubSubjectiveScalesBrief(wellnessCatalogue)
  const subjectiveScalesForProfiler = projectSubjectiveScalesForProfiler(wellnessCatalogue)

  const agentState: PremiumReportState = {
    document: clonePremiumDocument(document),
    datasets: new Map(),
    defaultAfter: 'end',
    dateRange: { from: displayRange.from, to: displayRange.to },
    displayRange: { from: displayRange.from, to: displayRange.to },
    fetchRange: { from: fetchRange.from, to: fetchRange.to },
    coverRange: { from: coverRange.from, to: coverRange.to },
    domainRanges,
    fetchWindows,
    clubId: args.clubId,
    athleteIds,
    language: args.language,
    heatScales,
    sqlFailures: new Map(),
    blockSql: false,
    toolHistory: [],
    jevValidations: 0,
    jevBlocked: 0,
    requestPrompt: args.prompt,
    coachPrompt: args.prompt,
    loadFlag: policy.loadFlag,
    canvasAsk: edit.canvasAsk,
    intent: route.intent,
    mustUseTools: true,
    explanationAsk: false,
    softPreserveCanvas: preserveCanvas,
    softLockedBlockIds: preserveCanvas ? priorBlockIds : undefined,
    softAllowBlockIds,
    templateMetaCache: new Map(),
    limits: {
      maxCharts: REPORT_V4_MAX_CHARTS,
      maxBlocks: REPORT_V4_MAX_BLOCKS,
      skipTextCaptionJev: true,
      deterministicCaptionGate: true,
      requireLiveDatasetId: true,
      allowNutritionScope: policy.allowNutritionScope,
      groundedAthleteNames: roster.map((row) => row.name),
      individualLinesAsk:
        artifactEnvelope.coverage.individualSheets ||
        policy.reportShape === COACH_REPORT_SHAPE.INDIVIDUAL_FOCUS,
      dropEmptyDaysDefault: artifactEnvelope.chartDefaults.dropEmptyDays,
      markLineValuesDefault: artifactEnvelope.chartDefaults.markLineValues,
    },
  }

  const run: ReportV4RunState = {
    route,
    roster,
    agentState,
    reportBrief: null,
    facts: new Map(),
    htmlArtifact: priorHtml,
    document: agentState.document,
    usage: emptyUsage(),
    iterationSecs: [],
    iterationCosts: [],
    iterations: 0,
    allowNutritionScope: policy.allowNutritionScope,
    clubName: club.name,
  }

  const sqlReferenceDate = (() => {
    const now = new Date()
    const y = now.getUTCFullYear()
    const m = String(now.getUTCMonth() + 1).padStart(2, '0')
    const d = String(now.getUTCDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  })()
  const context: AgentContext = {
    mode: 'team',
    clubId: args.clubId,
    clubName: club.name,
    athleteIds,
    referenceDate: sqlReferenceDate,
    language: args.language,
  }

  const schemaTitles = schemaTitlesForDomains(domains)
  const formulaIds = domains.length ? [...allowedFormulaIds(domains)] : []
  const catalogRange = resolveClubMetricCatalogRange({
    displayRange,
    fetchRange,
    domainRanges,
    fetches: fetchWindows,
  })
  const catalogStarted = Date.now()
  logger.info({ clubId: args.clubId, catalogRange }, 'report_v4.club_metric_catalog_start')
  const [catalog, rpeProbe, clubInsightScience] = await Promise.all([
    clubMetricCatalog(args.clubId, catalogRange),
    probeRpeSources({
      clubId: args.clubId,
      from: fetchRange.from,
      to: fetchRange.to,
      athleteIds,
    }),
    loadClubInsightScience({
      clubId: args.clubId,
      dateRange: displayRange,
      limit: 8,
    }).catch((error): ClubInsightScience[] => {
      logger.warn(
        { err: error instanceof Error ? error.message : String(error), clubId: args.clubId },
        'report_v4.club_insight_science_failed'
      )
      return []
    }),
  ])
  const clubInsightScienceHint = formatClubInsightScienceAnalystHint(clubInsightScience)
  run.clubInsightScience = clubInsightScience
  logger.info(
    {
      clubId: args.clubId,
      catalogRange,
      durationMs: Date.now() - catalogStarted,
      periodKpis: catalog.periodKpis.length,
      matchKpis: catalog.matchKpis.length,
      rpeFetchTable: rpeProbe.fetchTable,
      rpeSession: rpeProbe.sessionPrimary?.source ?? null,
      rpeBody: rpeProbe.bodyPrimary?.source ?? null,
      clubInsightScience: clubInsightScience.length,
    },
    'report_v4.club_metric_catalog_done'
  )
  const periodKpis = catalog.periodKpis
  const metricWhitelist = periodKpis.map((k) => k.name)

  const makeDbTool = async (envelope: string) =>
    createDbTool(envelope, context, undefined, {
      seriesOnly: false,
      reportSql: true,
      skipTeamPartition: true,
      maxResultRows: PREMIUM_REPORT_SQL_MAX_ROWS,
      maxResultBytes: PREMIUM_REPORT_SQL_MAX_BYTES,
      useVannaExamples: false,
      forceDomainTitles: schemaTitles,
    })

  logReportV4Banner({
    clubName: club.name,
    promptPreview: args.prompt.slice(0, 180),
    displayRange,
    domains,
  })

  const history = (args.history ?? []).slice(-PREMIUM_REPORT_HISTORY_MAX)
  const stageSecs: Record<string, number[]> = {}
  const onIteration = (stage: string) => (event: PremiumAgentIterationEvent) => {
    run.iterationSecs.push(event.durationSec)
    run.iterationCosts.push(event.usage.estimatedCostUsd)
    ;(stageSecs[stage] ??= []).push(event.durationSec)
    logReportV4Iteration({
      iteration: event.iteration,
      stopReason: event.stopReason,
      durationSec: event.durationSec,
      usage: event.usage,
      cumulative: event.cumulative,
      tools: event.tools,
      textPreview: `${stage}: ${event.textPreview ?? ''}`,
    })
  }
  const sumSecs = (stage: string): number =>
    Number((stageSecs[stage] ?? []).reduce((a, b) => a + b, 0).toFixed(3))

  let softApplied: string[] = []
  let softBlocked: string[] = []
  let softCoachMessage: string | undefined
  let softEditPath: SoftEditPath | undefined
  let softRefusals: SoftRefusal[] = []
  let coverageGateResult: ReturnType<typeof evaluateCoverageGate> = null
  let acwrHarvestStatus: 'ok' | 'pending' | 'empty_declared' | null =
    artifactEnvelope.harvest.requireLoadDomain ? 'pending' : null

  if (!needsFetch) {
    logger.info({ preserveCanvas: true }, 'report_v4.linker_skipped_soft_edit')
  } else {
    logger.info(
      { domains, fetchWindows: fetchWindows.length, athleteCount: athleteIds.length },
      'report_v4.linker_start'
    )
    progress('Récupération des données sportives...', 'Fetching sports data...')
    const envelope = [
      '[REPORT_V4_LINKER]',
      `Club: ${club.name}`,
      timeRangesBrief,
      `Allowed domains: ${domains.join(',')}`,
      `Club postes: ${clubPostes.join(', ') || 'none'}`,
      `Coverage populated: ${coverage.populatedDomains.join(',') || 'none'}`,
      `Coverage empty: ${coverage.emptyDomains.join(',') || 'none'}`,
      formatRpeProbeBrief(rpeProbe),
      policy.excludedDomains.length ? `Banned domains: ${policy.excludedDomains.join(',')}` : '',
      policy.monitoringPlaybook ? 'Mode: monitoring playbook' : '',
      preserveCanvas
        ? 'SOFT EDIT: fetch ONLY domains required by the coach delta — do not refetch the whole stack.'
        : '',
      'Fetch windows = complete map. SAME domain may appear twice with different from/to (e.g. wellness mood vs stress) — call the macro twice with those exact dates. load → Load lookback. Never expand every macro to Cover.',
      'FORBIDDEN: inventing a distant month the coach did not name. Fetch windows may be far from Display — honour them.',
      'One macro call per Fetch-windows entry (allowed + populated). Label datasets with their dateRange. If metrics=[mood] etc., keep that slice for the analyst.',
      'If coach asks for scores → fetch_daily_scores. If biomarkers → fetch_biomarkers_daily on its fetch window. Do not skip Fetch-windows domains that are allowed and populated.',
      `Coach: ${args.prompt.trim()}`,
    ]
      .filter(Boolean)
      .join('\n')
    agentState.requestPrompt = envelope
    const dbToolStarted = Date.now()
    logger.info({ schemaTitles: schemaTitles.length }, 'report_v4.linker_db_tool_start')
    const dbTool = await makeDbTool(envelope)
    logger.info({ durationMs: Date.now() - dbToolStarted }, 'report_v4.linker_db_tool_done')
    const runSql = async (sql: string) => dbTool.execute({ sql })
    const tools = [
      wrapQueryTool(dbTool, agentState),
      ...createPremiumMacroTools({ state: agentState, runSql, domains }),
      ...createWellnessSleepMacroTools({
        state: agentState,
        runSql,
        includeWellness: domains.includes(PREMIUM_DOMAIN.WELLNESS),
        includeSleep: domains.includes(PREMIUM_DOMAIN.SLEEP),
      }),
      createRosterMacroTool({ state: agentState, roster }),
      ...createPremiumDataTools(agentState, { domains }),
    ]
    logger.info({ toolCount: tools.length }, 'report_v4.linker_agent_invoke')
    const result = await runPremiumReportAgent({
      systemPrompt: buildLinkerSystemPrompt({
        clubId: args.clubId,
        clubName: club.name,
        displayRange,
        fetchRange,
        coverRange,
        timeRanges: timeRangesBrief,
        domains,
        route,
        policy,
        clubPostes,
        schemaTitles,
      }),
      userPrompt: JSON.stringify({
        stage: 'linker',
        athletes,
        domains,
        clubPostes,
        excludedDomains: policy.excludedDomains,
        monitoringPlaybook: policy.monitoringPlaybook,
        gpsMacroColumns: periodKpis.map((k) => k.alias),
        playerLoadSources: [],
        periodMetricWhitelist: metricWhitelist ?? undefined,
        softEdit: preserveCanvas,
        request: envelope,
      }),
      history: [],
      tools,
      state: agentState,
      maxIterations: preserveCanvas
        ? REPORT_V4_SOFT_LINKER_MAX_ITERATIONS
        : shortWindow
          ? REPORT_V4_LINKER_MAX_ITERATIONS_SHORT
          : REPORT_V4_LINKER_MAX_ITERATIONS,
      forceAnswerAt: preserveCanvas
        ? REPORT_V4_SOFT_LINKER_FORCE_ANSWER_AT
        : shortWindow
          ? REPORT_V4_LINKER_FORCE_ANSWER_AT_SHORT
          : REPORT_V4_LINKER_FORCE_ANSWER_AT,
      minIterations: preserveCanvas
        ? REPORT_V4_SOFT_LINKER_MIN_ITERATIONS
        : shortWindow
          ? REPORT_V4_LINKER_MIN_ITERATIONS_SHORT
          : REPORT_V4_LINKER_MIN_ITERATIONS,
      maxEndTurnNudges: preserveCanvas
        ? Math.max(2, Math.min(4, harvestPlan.length + 1))
        : REPORT_V4_MAX_END_TURN_NUDGES,
      continuePrompt: REPORT_V4_LINKER_CONTINUE,
      acceptEndTurn: (state) => {
        const harvestNudge = acceptLinkerHarvestEndTurn(state, harvestPlan)
        if (harvestNudge) return harvestNudge
        return acwrHarvestNudge(
          verifyAcwrHarvest(state, artifactEnvelope.harvest.requiredMetrics)
        )
      },
      maxTokens: preserveCanvas
        ? REPORT_V4_MAX_TOKENS
        : shortWindow
          ? REPORT_V4_LINKER_MAX_TOKENS_SHORT
          : REPORT_V4_MAX_TOKENS,
      temperature: REPORT_V4_TEMPERATURE,
      onIteration: onIteration('linker'),
      signal: args.signal,
    })
    addUsage(run.usage, result.usage)
    run.iterations += result.iterations
    const datasets = catalogDatasets(agentState).length
    const harvestVerification = verifyHarvestPlan(agentState, harvestPlan)
    const acwrHarvest = verifyAcwrHarvest(agentState, artifactEnvelope.harvest.requiredMetrics)
    if (artifactEnvelope.harvest.requireLoadDomain) {
      acwrHarvestStatus = acwrHarvest.status
    }
    if (!acwrHarvest.ok) {
      logger.warn(
        {
          status: acwrHarvest.status,
          missing: acwrHarvest.missing,
          triedLoadSummary: acwrHarvest.triedLoadSummary,
          hasAcwrColumn: acwrHarvest.hasAcwrColumn,
        },
        'report_v4.acwr_harvest_incomplete'
      )
    } else if (artifactEnvelope.harvest.requireLoadDomain) {
      logger.info(
        {
          status: acwrHarvest.status,
          triedLoadSummary: acwrHarvest.triedLoadSummary,
          hasAcwrColumn: acwrHarvest.hasAcwrColumn,
          emptyDeclared: acwrHarvest.emptyDeclared,
        },
        acwrHarvest.emptyDeclared
          ? 'report_v4.acwr_harvest_empty_declared'
          : 'report_v4.acwr_harvest_ok'
      )
    }
    const emptyAfterTry = harvestVerification.verdicts
      .filter((row) => row.status === 'empty_after_try')
      .map((row) => (row.window ? `${row.domain}@${row.window.from}→${row.window.to}` : row.domain))
    if (emptyAfterTry.length > 0) {
      logger.warn({ emptyAfterTry }, 'report_v4.harvest_empty_after_try')
    }
    logReportV4AgentTotal({
      agent: 'linker',
      iterations: result.iterations,
      durationSec: sumSecs('linker'),
      usage: result.usage,
      detail: `datasets=${datasets}`,
    })
  }

  const softProseOnly =
    preserveCanvas && Boolean(priorHtml) && edit.routeFlags.partialProse
  const recommendationStrip = softProseOnly && edit.routeFlags.recommendationStrip
  const skipAnalystForSoftEditorial =
    softEditorialOnly && Boolean(priorHtml) && artifactEnvelope.contracts.softAllowed
  const skipAnalystForSoftOps =
    preserveCanvas &&
    Boolean(priorHtml) &&
    artifactEnvelope.mode === 'soft_ops' &&
    artifactEnvelope.contracts.softAllowed &&
    !softOps?.needsFetch &&
    !softOps?.restoreSheets &&
    !softOps?.layoutRepair &&
    !softOps?.enrichExistingCharts &&
    !softOps?.additiveSoft
  const skipAnalystForSoftPath = skipAnalystForSoftEditorial || skipAnalystForSoftOps
  const pathCostClass = resolvePathCostClass({
    envelope: artifactEnvelope,
    preserveCanvas,
    softEditorialOnly,
    skipAnalyst: skipAnalystForSoftPath,
    needsFetch,
  })
  logger.info(
    { pathCostClass, budgetUsd: pathCostBudgetUsd(pathCostClass) },
    'report_v4.path_cost_class'
  )

  if (
    preserveCanvas &&
    priorHtml &&
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
    const early = applyResolvedSoftEditorial({
      html: priorHtml,
      document: agentState.document,
      ops: earlyOps,
      language: args.language,
      clubName: club.name,
      reportTitle: agentState.document.title,
    })
    priorHtml = early.html
    agentState.document = early.document
    run.document = early.document
    softEditorialAppliedEarly = true
    logger.info(
      {
        removedSections: early.removed.length,
        droppedBlockIds: early.droppedBlockIds,
        gates: early.gates,
      },
      'report_v4.soft_editorial_early_remove'
    )
  }

  let harvestDataProfile: HarvestDataProfile | null = null
  if (agentState.datasets.size > 0) {
    harvestDataProfile = profileHarvestDatasets({
      datasets: agentState.datasets.values(),
      window: displayRange,
      sqlRowCapHint: PREMIUM_REPORT_SQL_MAX_ROWS,
      subjectiveScales: subjectiveScalesForProfiler,
    })
    logger.info(
      {
        datasets: harvestDataProfile.datasets.length,
        unusableDomains: harvestDataProfile.unusableDomains,
        emptyDomains: harvestDataProfile.emptyDomains,
        partial: harvestDataProfile.domains
          .filter((row) => row.verdict === 'partial')
          .map((row) => row.domain),
      },
      'report_v4.data_profile'
    )
  }
  const dataProfileHint = harvestDataProfile
    ? formatDataProfileAnalystHint(harvestDataProfile)
    : undefined
  const dataProfilePacket = harvestDataProfile
    ? compactDataProfileForLlm(harvestDataProfile)
    : null

  {
    if (recommendationStrip || skipAnalystForSoftPath) {
      if (recommendationStrip) {
        logger.info('report_v4.soft_prose_skip_analyst')
        stripRecommendationSectionsFromDocument(agentState.document)
      } else if (skipAnalystForSoftOps) {
        logger.info(
          {
            mode: artifactEnvelope.mode,
            vizOps: artifactEnvelope.contracts.vizOps.map((op) => op.kind),
          },
          'report_v4.soft_ops_skip_analyst'
        )
      } else {
        logger.info(
          {
            ops: softOps?.ops.map((op) => op.type) ?? [],
            removeQueries: softOps?.removeQueries ?? [],
            ensureToc: softOps?.ensureToc ?? false,
          },
          'report_v4.soft_editorial_skip_analyst'
        )
      }
      run.document = finalizeAnalystCanvas({
        document: agentState.document,
        displayRange,
        language: args.language,
        clubPostes,
        fallbackTitle: args.prompt,
        heatScales,
      })
      agentState.document = run.document
      run.reportBrief = synthesizeReportBriefIfMissing({
        insight: run.reportBrief,
        document: run.document,
        displayRange,
        harvestHasRows: harvestHasUsableDatasets(agentState),
      })
      logger.info(
        {
          blocks: run.document.blocks.length,
          charts: canvasStats(run.document).charts,
          tables: canvasStats(run.document).tables,
          insight: Boolean(run.reportBrief),
          iterations: 0,
          macrosSkipped: false,
          shortWindow,
          softProseOnly: recommendationStrip,
          softEditorialOnly: skipAnalystForSoftEditorial,
          softOpsOnly: skipAnalystForSoftOps,
        },
        'report_v4.analyst_done'
      )
    } else {
      progress('Analyse des données et rédaction...', 'Analyzing data and writing...')
      const datasets = catalogDatasets(agentState)
      const hasLinkedData = datasets.some((d) => d.id !== 'roster' && d.rows > 0)
      const envelope = [
        '[REPORT_V4_ANALYST]',
        `Club: ${club.name}`,
        `Here is the data for the Display period: ${displayRange.from} to ${displayRange.to}.`,
        `Allowed domains: ${domains.join(',')}`,
        `Club postes: ${clubPostes.join(', ') || 'none'}`,
        policy.excludedDomains.length ? `Banned domains: ${policy.excludedDomains.join(',')}` : '',
        policy.sectionOrder.length
          ? `Structure (coach): ${policy.sectionOrder.join(' → ')}`
          : policy.monitoringPlaybook
            ? 'Structure: squad story → data-justified individuals → relevant follow-ups.'
            : '',
        `Datasets: ${
          datasets
            .map((d) =>
              d.dateRange
                ? `${d.id}(${d.rows},${d.dateRange.from}→${d.dateRange.to})`
                : `${d.id}(${d.rows})`
            )
            .join(', ') || 'none'
        }`,
        'ReportBrief.period and canvas titles use the Display period. Prefer datasetIds whose dateRange overlaps Display.',
        'Top-N tables: title Top N ⇒ exactly N rows.',
        domains.includes(PREMIUM_DOMAIN.SCORES)
          ? 'Scores: separate charts for performance_score and injury_risk_score when both asked. Individual lines ask → splitAthletes chunks (metric titles + i/n, no athlete name ranges) + separate team mean±minmax aggregates. Staff overview without individuals → athletes:[watch] or team-mean only (no full-roster split).'
          : '',
        'Top-N + mean (GPS etc.): filter/rank N athletes on real columns, add_chart with athletes=[N names], charts_to_team mode=overlay. Title Top N ⇒ N series (+ mean).',
        domains.includes(PREMIUM_DOMAIN.GPS) && periodKpis.length > 0
          ? `GPS periodKpis: ${periodKpis.map((k) => k.alias).join(', ')}. ${
              policy.monitoringPlaybook || multiSectionAsk
                ? 'Chart 2–4 distinct families — not distance+HMLD only.'
                : 'Chart only the families THIS ask needs (system GPS rails decide density).'
            }`
          : '',
        domains.includes(PREMIUM_DOMAIN.BIOMARKERS)
          ? 'Biomarkers: use fetch_biomarkers_daily / fetch_biomarkers on the biomarkers fetch window. If the dataset has zero lab rows, commit a short brief note "no lab rows" under a Biomarkers heading — do not fill with wellness/GPS columns.'
          : '',
        preserveCanvas
          ? `SOFT EDIT (${edit.canvasAsk.kind}): keep layout. ${softAnalystContinueForAsk({
              additive: Boolean(softOps?.additiveSoft),
              restoreSheets: Boolean(softOps?.restoreSheets),
              addSectionProse: Boolean(softOps?.addSectionProse),
              layoutRepair: Boolean(softOps?.layoutRepair),
              enrichExistingCharts: Boolean(softOps?.enrichExistingCharts),
            })}`
          : '',
        `Coach: ${args.prompt.trim()}`,
      ]
        .filter(Boolean)
        .join('\n')
      agentState.requestPrompt = envelope
      agentState.canvasAsk = edit.canvasAsk
      agentState.mustUseTools = true
      agentState.toolHistory = []
      if ((policy.monitoringPlaybook && hasLinkedData) || preserveCanvas) {
        agentState.blockSql = true
      }
      const layoutRepairSoft = Boolean(preserveCanvas && softOps?.layoutRepair)
      const enrichSoft = Boolean(preserveCanvas && softOps?.enrichExistingCharts)
      const additiveSoft =
        preserveCanvas &&
        !layoutRepairSoft &&
        !enrichSoft &&
        (Boolean(softOps?.additiveSoft) ||
          (needsFetch &&
            (edit.canvasAsk.kind === PREMIUM_CANVAS_ASK.NEW_VIZ ||
              edit.routeFlags.additive)))
      const softDataMutate = additiveSoft || layoutRepairSoft || enrichSoft
      if (preserveCanvas && softDataMutate) {
        agentState.blockSql = false
      }
      const keepMacros =
        !isMicroSoft &&
        needsFetch &&
        (!preserveCanvas || softDataMutate) &&
        (!hasLinkedData || shortWindow || softDataMutate)
      const withFactTools = <T extends ReturnType<typeof createReportBriefTools>>(tools: T) =>
        [...tools, ...createReportFactTools(run)] as T
      const tools = await (async () => {
        if (preserveCanvas && !needsFetch && !softDataMutate) {
          agentState.blockSql = true
          return withFactTools([
            ...createPremiumDocumentTools(agentState),
            ...createReportBriefTools(run),
          ])
        }
        if (isMicroSoft || (preserveCanvas && !softDataMutate)) {
          agentState.blockSql = true
          return withFactTools([
            ...createPremiumDocumentTools(agentState),
            ...createReportBriefTools(run),
          ])
        }
        const dataAndDoc = withFactTools([
          ...createPremiumDataTools(agentState, { domains }),
          ...createPremiumDocumentTools(agentState),
          ...createReportBriefTools(run),
        ])
        if (!keepMacros) return dataAndDoc
        const dbTool = await makeDbTool(envelope)
        const runSql = async (sql: string) => dbTool.execute({ sql })
        return [
          ...createPremiumMacroTools({ state: agentState, runSql, domains }),
          ...createWellnessSleepMacroTools({
            state: agentState,
            runSql,
            includeWellness: domains.includes(PREMIUM_DOMAIN.WELLNESS),
            includeSleep: domains.includes(PREMIUM_DOMAIN.SLEEP),
          }),
          createRosterMacroTool({ state: agentState, roster }),
          ...dataAndDoc,
        ]
      })()
      const priorSoftDigest = canvasSoftDigest(agentState.document)
      const analystContinue = preserveCanvas
        ? softAnalystContinueForAsk({
            additive: additiveSoft,
            restoreSheets: Boolean(softOps?.restoreSheets),
            addSectionProse: Boolean(softOps?.addSectionProse),
            layoutRepair: layoutRepairSoft,
            enrichExistingCharts: Boolean(softOps?.enrichExistingCharts),
          })
        : REPORT_V4_ANALYST_CONTINUE
      const artifactOutline =
        softInventory?.outline?.length && preserveCanvas
          ? softInventory.outline
          : preserveCanvas && priorHtml
            ? buildSoftArtifactOutline(priorHtml)
            : []
      const softBlockIndex = softInventory
        ? [...softInventory.charts, ...softInventory.tables].slice(0, 48)
        : []
      const softHistory =
        preserveCanvas && (layoutRepairSoft || additiveSoft || enrichSoft || softOps?.needsAnalyst)
          ? history
          : preserveCanvas
            ? []
            : history
      const softContextPacket = preserveCanvas
        ? {
            artifactOutline,
            blockIndex: softBlockIndex,
            softOps: softOps ? softOpsAgentPacket(softOps) : null,
            softAllowBlockIds: softAllowBlockIds ? [...softAllowBlockIds] : null,
            softTargetsUnresolved: Boolean(softAllowBlockIds && softAllowBlockIds.size === 0),
            priorBriefTitle: run.reportBrief?.title ?? agentState.document.title ?? null,
            hasToc: softInventory?.hasToc ?? false,
            sessionFocus: args.sessionFocus ?? null,
          }
        : null
      const result = await runPremiumReportAgent({
        systemPrompt: preserveCanvas
          ? buildSoftAnalystSystemPrompt({
              clubName: club.name,
              language: args.language,
              clubPostes,
              displayRange,
              allowNutritionScope: policy.allowNutritionScope,
              additive: additiveSoft,
              restoreSheets: Boolean(softOps?.restoreSheets),
              addSectionProse: Boolean(softOps?.addSectionProse),
              layoutRepair: layoutRepairSoft,
              wantsTeamMean: Boolean(softOps?.wantsTeamMean),
              enrichExistingCharts: Boolean(softOps?.enrichExistingCharts),
              targetsUnresolved: Boolean(softAllowBlockIds && softAllowBlockIds.size === 0),
              subjectiveScalesLine: subjectiveScalesLine || undefined,
            })
          : buildAnalystSystemPrompt({
              clubId: args.clubId,
              clubName: club.name,
              displayRange,
              domains,
              route,
              language: args.language,
              policy,
              clubPostes,
              periodKpis,
              catalog,
              coachPrompt: args.prompt,
              multiSection: multiSectionAsk,
              dataProfileHint,
              clubInsightScienceHint,
              subjectiveScalesLine: subjectiveScalesLine || undefined,
              namedAthletes,
            }),
        userPrompt: JSON.stringify(
          isMicroSoft
            ? {
                stage: 'analyst_soft_micro',
                coach: args.prompt.trim(),
                canvasAsk: edit.canvasAsk.kind,
                clubPostes,
                displayRange,
                allowNutritionScope: policy.allowNutritionScope,
                ...softContextPacket,
                current: compactPremiumDocument(agentState.document),
                ...(dataProfilePacket ? { dataProfile: dataProfilePacket } : {}),
                ...(clubInsightScience.length
                  ? {
                      clubInsightScience: clubInsightScience.slice(0, 5).map((row) => ({
                        name: row.name,
                        description: row.description.slice(0, 160),
                        meanAbsImportance: row.meanAbsImportance,
                      })),
                    }
                  : {}),
                ...(namedAthletes.length ? { namedAthletes } : {}),
                ...(subjectiveScalesLine
                  ? { subjectiveScales: projectWellnessScalesForDesigner(wellnessCatalogue) }
                  : {}),
              }
            : {
                stage: preserveCanvas ? 'analyst_soft' : 'analyst',
                athletes,
                clubPostes,
                domains,
                excludedDomains: policy.excludedDomains,
                monitoringPlaybook: policy.monitoringPlaybook,
                datasets,
                formulas: formulaCatalogForLlm({ formulaIds }),
                current: compactPremiumDocument(agentState.document),
                ...(softContextPacket ?? {}),
                ...(namedAthletes.length ? { namedAthletes } : {}),
                ...(clubInsightScience.length
                  ? {
                      clubInsightScience: clubInsightScience.slice(0, 5).map((row) => ({
                        name: row.name,
                        description: row.description.slice(0, 160),
                        meanAbsImportance: row.meanAbsImportance,
                      })),
                    }
                  : {}),
                grain: route.grain,
                analysisDepth: route.analysisDepth,
                daySpan,
                softEdit: preserveCanvas,
                artifact: analystPacketFromEnvelope(artifactEnvelope),
                request: envelope,
                ...(dataProfilePacket ? { dataProfile: dataProfilePacket } : {}),
                ...(subjectiveScalesLine
                  ? { subjectiveScales: projectWellnessScalesForDesigner(wellnessCatalogue) }
                  : {}),
              }
        ),
        history: softHistory,
        tools,
        state: agentState,
        maxIterations: analystMaxIterations,
        forceAnswerAt: analystForceAnswerAt,
        minIterations: analystMinIterations,
        maxEndTurnNudges: preserveCanvas
          ? softDataMutate ||
            edit.canvasAsk.kind === PREMIUM_CANVAS_ASK.NEW_VIZ ||
            edit.canvasAsk.kind === PREMIUM_CANVAS_ASK.RESHAPE ||
            edit.canvasAsk.kind === PREMIUM_CANVAS_ASK.REMOVE
            ? 4
            : 2
          : REPORT_V4_MAX_END_TURN_NUDGES,
        continuePrompt:
          artifactEnvelope.coverage.individualSheets &&
          artifactEnvelope.coverage.requiredNames.length > 0
            ? `${analystContinue}\n${coverageGateMessage(artifactEnvelope.coverage.requiredNames.length, 0)} Roster names to cover: ${artifactEnvelope.coverage.requiredNames.slice(0, 24).join(', ')}.`
            : analystContinue,
        acceptEndTurn: (state) => {
          const thin = rejectThinCanvas({
            preserveCanvas,
            continueMsg: analystContinue,
            shortWindow: useShortDepth,
            priorSoftDigest: preserveCanvas ? priorSoftDigest : undefined,
          })(state)
          if (thin) return thin
          const coverage = evaluateCoverageGate(state.document, artifactEnvelope)
          if (coverage && !coverage.ok) {
            return coverageGateMessage(coverage.required, coverage.delivered)
          }
          if (preserveCanvas && softDataMutate && softOps) {
            const newCharts = state.document.blocks.filter(
              (b) => b.type === 'chart' && !priorBlockIds.has(b.id)
            ).length
            const newTexts = state.document.blocks.filter(
              (b) => b.type === 'text' && !priorBlockIds.has(b.id)
            ).length
            const newHeadings = state.document.blocks.filter(
              (b) => b.type === 'heading' && !priorBlockIds.has(b.id)
            ).length
            if (
              softOps.restoreSheets &&
              !softOps.layoutRepair &&
              newCharts === 0 &&
              newHeadings < 2
            ) {
              return `${analystContinue} Still missing individual sheets — add athlete headings + charts from datasets.`
            }
            if (softOps.addSectionProse && newTexts === 0) {
              return `${analystContinue} Still missing section captions — add_text under charts/sections.`
            }
            if (softOps.layoutRepair && canvasSoftDigest(state.document) === priorSoftDigest) {
              return `${analystContinue} Layout still unchanged — pair athletes to charts via update_block/remove_block.`
            }
            if (
              softOps.enrichExistingCharts &&
              canvasSoftDigest(state.document) === priorSoftDigest
            ) {
              return `${analystContinue} Existing charts unchanged — update_block with live datasetId on individual/focus chart ids.`
            }
          }
          if (!preserveCanvas) {
            const stats = canvasStats(state.document)
            const coverageGap = askCoverageContinue({
              domains,
              chartCount: stats.charts,
              tableCount: stats.tables,
              hasBrief: Boolean(run.reportBrief),
              reportShape: policy.reportShape,
              multiSection: multiSectionAsk,
              monitoringPlaybook: policy.monitoringPlaybook,
            })
            if (coverageGap) return coverageGap
          }
          return rejectAnalystUngroundedEndTurn({
            getBrief: () => run.reportBrief,
            roster,
            allowNutritionScope: policy.allowNutritionScope,
            requireBrief: !preserveCanvas,
            clubName: club.name,
          })(state)
        },
        maxTokens: isMicroSoft ? 4096 : REPORT_V4_MAX_TOKENS,
        temperature: preserveCanvas ? 0.15 : REPORT_V4_TEMPERATURE,
        onIteration: onIteration('analyst'),
        signal: args.signal,
      })
      addUsage(run.usage, result.usage)
      run.iterations += result.iterations
      const analystUsage = { ...result.usage }
      let analystIterations = result.iterations

      const hasHarvestData = harvestHasUsableDatasets(agentState)
      const needsAnalystRecovery =
        !preserveCanvas && !useShortDepth && hasHarvestData && canvasStats(agentState.document).thin
      if (!hasHarvestData && !preserveCanvas) {
        logger.info(
          { charts: canvasStats(agentState.document).charts },
          'report_v4.analyst_recovery_skipped_empty_harvest'
        )
      }
      if (needsAnalystRecovery) {
        logger.warn(
          {
            ...canvasStats(agentState.document),
          },
          'report_v4.analyst_thin_canvas_recovery'
        )
        agentState.requestPrompt = [
          envelope,
          REPORT_V4_ANALYST_RECOVERY_CONTINUE,
          `Current charts=${canvasStats(agentState.document).charts} tables=${canvasStats(agentState.document).tables}`,
          `Use datasetIds: ${
            catalogDatasets(agentState)
              .map((d) => d.id)
              .join(', ') || 'none — call macros first'
          }`,
        ].join('\n')
        agentState.mustUseTools = true
        agentState.toolHistory = []
        agentState.blockSql = true
        const recoveryDbTool = await makeDbTool(agentState.requestPrompt)
        const recoveryRunSql = async (sql: string) => recoveryDbTool.execute({ sql })
        const recoveryTools = [
          ...createPremiumMacroTools({ state: agentState, runSql: recoveryRunSql, domains }),
          ...createWellnessSleepMacroTools({
            state: agentState,
            runSql: recoveryRunSql,
            includeWellness: domains.includes(PREMIUM_DOMAIN.WELLNESS),
            includeSleep: domains.includes(PREMIUM_DOMAIN.SLEEP),
          }),
          createRosterMacroTool({ state: agentState, roster }),
          ...createPremiumDataTools(agentState, { domains }),
          ...createPremiumDocumentTools(agentState),
          ...createReportBriefTools(run),
          ...createReportFactTools(run),
        ]
        const recovery = await runPremiumReportAgent({
          systemPrompt: buildAnalystSystemPrompt({
            clubId: args.clubId,
            clubName: club.name,
            displayRange,
            domains,
            route,
            language: args.language,
            policy,
            clubPostes,
            periodKpis,
            catalog,
            coachPrompt: args.prompt,
            multiSection: multiSectionAsk,
            dataProfileHint,
            clubInsightScienceHint,
            subjectiveScalesLine: subjectiveScalesLine || undefined,
            namedAthletes,
          }),
          userPrompt: JSON.stringify({
            stage: 'analyst_recovery',
            clubPostes,
            datasets: catalogDatasets(agentState),
            current: compactPremiumDocument(agentState.document),
            request: agentState.requestPrompt,
            ...(dataProfilePacket ? { dataProfile: dataProfilePacket } : {}),
            ...(subjectiveScalesLine
              ? { subjectiveScales: projectWellnessScalesForDesigner(wellnessCatalogue) }
              : {}),
          }),
          history: [],
          tools: recoveryTools,
          state: agentState,
          maxIterations: REPORT_V4_ANALYST_RECOVERY_MAX_ITERATIONS,
          forceAnswerAt: REPORT_V4_ANALYST_RECOVERY_MAX_ITERATIONS - 1,
          minIterations: 2,
          maxEndTurnNudges: 5,
          continuePrompt: REPORT_V4_ANALYST_RECOVERY_CONTINUE,
          acceptEndTurn: (state) => {
            const thin = rejectThinCanvas({
              preserveCanvas,
              continueMsg: REPORT_V4_ANALYST_RECOVERY_CONTINUE,
              shortWindow: useShortDepth,
            })(state)
            if (thin) return thin
            return rejectAnalystUngroundedEndTurn({
              getBrief: () => run.reportBrief,
              roster,
              allowNutritionScope: policy.allowNutritionScope,
              requireBrief: true,
              clubName: club.name,
            })(state)
          },
          maxTokens: REPORT_V4_MAX_TOKENS,
          temperature: REPORT_V4_TEMPERATURE,
          onIteration: onIteration('analyst_recovery'),
          signal: args.signal,
        })
        addUsage(run.usage, recovery.usage)
        addUsage(analystUsage, recovery.usage)
        run.iterations += recovery.iterations
        analystIterations += recovery.iterations
        agentState.blockSql = false
      }

      run.document = finalizeAnalystCanvas({
        document: agentState.document,
        displayRange,
        language: args.language,
        clubPostes,
        fallbackTitle: args.prompt,
        heatScales,
      })
      const strippedNutrition = stripNutritionProseFromDocument(
        run.document,
        policy.allowNutritionScope
      )
      const strippedViz = stripUngroundedVizBlocks(run.document)
      const realignedProse = realignCrossedSectionProse(run.document)
      if (strippedNutrition > 0 || strippedViz.strippedIds.length > 0 || realignedProse > 0) {
        logger.warn(
          {
            nutritionBlocks: strippedNutrition,
            ungroundedViz: strippedViz.strippedIds,
            realignedProse,
          },
          'report_v4.grounding_strip_after_analyst'
        )
      }
      run.document = heatStaffTablesInDocument(run.document, args.language, heatScales)
      agentState.document = run.document
      run.reportBrief = synthesizeReportBriefIfMissing({
        insight: run.reportBrief,
        document: run.document,
        displayRange,
        harvestHasRows: harvestHasUsableDatasets(agentState),
      })
      if (!preserveCanvas && harvestHasUsableDatasets(agentState) && !run.reportBrief) {
        logger.warn(
          { title: run.document.title },
          'report_v4.report_brief_unavailable_after_synthesize'
        )
      }
      const coverageGap = !preserveCanvas
        ? askCoverageContinue({
            domains,
            chartCount: canvasStats(run.document).charts,
            tableCount: canvasStats(run.document).tables,
            hasBrief: Boolean(run.reportBrief),
            reportShape: policy.reportShape,
            multiSection: multiSectionAsk,
            monitoringPlaybook: policy.monitoringPlaybook,
          })
        : null
      if (coverageGap) {
        logger.warn({ coverageGap, domains }, 'report_v4.ask_coverage_incomplete')
      }
      {
        const coverage = evaluateCoverageGate(run.document, artifactEnvelope)
        coverageGateResult = coverage
        if (coverage) {
          logger.info(
            {
              required: coverage.required,
              delivered: coverage.delivered,
              missing: coverage.missing,
              mode: artifactEnvelope.mode,
            },
            'report_v4.coverage_gate'
          )
          if (!coverage.ok) {
            const nextBrief = annotateBriefCoverageShortfall(
              run.reportBrief,
              coverage,
              args.language === 'en' ? 'en' : 'fr'
            )
            if (nextBrief) run.reportBrief = nextBrief
            else {
              logger.warn(
                { shortfall: `${coverage.delivered}/${coverage.required}` },
                'report_v4.coverage_gate_no_brief'
              )
            }
          }
        }
      }

      const finalStats = canvasStats(run.document)
      logReportV4AgentTotal({
        agent: 'analyst',
        iterations: analystIterations,
        durationSec: Number((sumSecs('analyst') + sumSecs('analyst_recovery')).toFixed(3)),
        usage: analystUsage,
        detail: `blocks=${run.document.blocks.length} charts=${finalStats.charts} tables=${finalStats.tables} insight=${Boolean(run.reportBrief)}`,
      })
      logger.info(
        {
          blocks: run.document.blocks.length,
          charts: finalStats.charts,
          tables: finalStats.tables,
          insight: Boolean(run.reportBrief),
          iterations: analystIterations,
          macrosSkipped: hasLinkedData,
          shortWindow,
          multiSectionAsk,
        },
        'report_v4.analyst_done'
      )
    }
  }

  agentState.blockSql = false

  const recoverTemplateArtifact = async (reason: string) => {
    try {
      run.htmlArtifact = await renderDesignerTemplateArtifact({
        run,
        clubName: club.name,
        language: args.language,
        designPack,
        populatedDomains: domains,
        coachPrompt: args.prompt,
      })
      run.templateRecoveredReason = reason
      logger.info(
        { reason: `${reason}_recovered`, htmlBytes: run.htmlArtifact.length },
        'report_v4.designer_template_recovered'
      )
      return true
    } catch (error) {
      logger.error({ err: error, reason }, 'report_v4.designer_template_recover_failed')
      run.htmlArtifact = null
      return false
    }
  }

  {
    let charts = collectArtifactCharts(agentState.document, heatScales)
    let chartCount = charts.length

    const softPathAllowed =
      preserveCanvas &&
      Boolean(priorHtml) &&
      artifactEnvelope.contracts.softAllowed &&
      artifactEnvelope.mode !== 'gated_rebuild'

    if (preserveCanvas && priorHtml && !softPathAllowed) {
      needsFreshArtifact = true
      run.htmlArtifact = null
      logger.info(
        {
          mode: artifactEnvelope.mode,
          softAllowed: artifactEnvelope.contracts.softAllowed,
          preserveCanvas: true,
        },
        'report_v4.soft_path_skipped_gated_rebuild'
      )
    }

    if (softPathAllowed && priorHtml) {
      const softPrep = prepareSoftArtifactPath({
        document: agentState.document,
        envelope: artifactEnvelope,
        softOps,
        softEditorialOnly,
      })
      if (softPrep.opResult.patched > 0) {
        agentState.document = softPrep.document
        run.document = softPrep.document
      }
      const soft = runSoftRebind({
        priorHtml,
        document: softPrep.document,
        priorDocument: priorDocumentForSoft,
        priorBlockIds,
        priorChartCount,
        softOps: softPrep.softOps,
        designOps: softPrep.designOps,
        softProseOnly,
        softEditorialOnly: softPrep.softEditorialOnly,
        softEditorialAppliedEarly,
        recommendationStrip,
        canvasAskKind: edit.canvasAsk.kind,
        heatScales,
        designPack,
        language: args.language,
        clubName: club.name,
        progress,
        facts: run.facts,
      })
      agentState.document = soft.document
      run.document = soft.document
      run.htmlArtifact = soft.htmlArtifact
        ? refreshArtifactPresentationCss(soft.htmlArtifact, designPack)
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
        const diff = evaluateSoftDiffGate({
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
          run.document = clonePremiumDocument(priorDocumentForSoft)
          agentState.document = run.document
          run.htmlArtifact = priorHtml
            ? refreshArtifactPresentationCss(priorHtml, designPack)
            : priorHtml
          softEditPath = 'local_refused'
          softRefusals = refusalFromDiffGate({
            mutatedOutsideAllowlist: diff.mutatedOutsideAllowlist,
            orderChanged: diff.orderChanged,
            documentFieldsChanged: diff.documentFieldsChanged,
            language: args.language,
          })
          softCoachMessage = formatSoftEditPathMessage({
            path: 'local_refused',
            language: args.language,
            detail:
              args.language === 'fr'
                ? "Je n'ai pas pu appliquer la modification localement (hors périmètre). Le rapport précédent a été conservé. Voulez-vous que je refasse le rapport ?"
                : 'I could not apply the change locally (outside the allowed scope). The previous report was kept. Should I rebuild the report?',
          })
          logger.warn(
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
      charts = collectArtifactCharts(agentState.document, heatScales)
      chartCount = charts.length
    }

    const needsDesigner = needsFreshArtifact && !artifactHtmlLooksValid(run.htmlArtifact)

    if (needsDesigner) {
      progress('Mise en page du rapport...', 'Laying out the report...')
      const designerMode = softRebindRepair ? 'soft_rebind_repair' : 'free_html_artifact'
      const envelope = [
        '[REPORT_V4_DESIGNER]',
        softRebindRepair ? '[SOFT_REBIND_REPAIR]' : '',
        `Club: ${club.name}`,
        `Display period: ${displayRange.from} → ${displayRange.to}`,
        `Pack: ${designPack.id}`,
        softRebindRepair
          ? 'Mode: repair soft rebind — set_report_html with every requiredChartIds host; keep canvas chart ids'
          : 'Mode: free HTML via set_report_html (Claude artifact)',
        `Charts to host: ${chartCount}`,
        `Brief signals: ${run.reportBrief?.signals.length ?? 0}`,
        policy.sectionOrder.length
          ? `REQUIRED section order (coach): ${policy.sectionOrder.join(' → ')}`
          : '',
        `Coach: ${args.prompt.trim()}`,
      ]
        .filter(Boolean)
        .join('\n')
      agentState.requestPrompt = envelope
      agentState.mustUseTools = true
      agentState.toolHistory = []
      const wellnessScales = projectWellnessScalesForDesigner(wellnessCatalogue)
      const wellnessScalesLine = wellnessScales
        .map(
          (scale) =>
            `${scale.field}(${scale.label || scale.field}): ${scale.min}–${scale.max}, isReversed=${scale.isReversed}`
        )
        .join(' | ')
      const tools = createDesignerTools({
        run,
        clubName: club.name,
        language: args.language,
        designPack,
        populatedDomains: domains,
        coachPrompt: args.prompt,
        wellnessScales,
        sectionOrder: policy.sectionOrder,
        individualSheetsAsk:
          artifactEnvelope.coverage.individualSheets ||
          policy.reportShape === COACH_REPORT_SHAPE.INDIVIDUAL_FOCUS ||
          Boolean(agentState.limits.individualLinesAsk),
      })
      const rejectMissingArtifact = (_state: typeof agentState): string | null => {
        if (artifactHtmlLooksValid(run.htmlArtifact)) return null
        return REPORT_V4_DESIGNER_CONTINUE
      }
      const designerInstruction = softRebindRepair
        ? 'SOFT REBIND REPAIR: deterministic rebind failed. Call get_design_context, then set_report_html with every requiredChartIds host once. Preserve canvas chart ids. Do not invent numbers. If grounding rejects, fix cited spans and retry set_report_html (server auto-templates after two rejects).'
        : 'Call get_design_context then set_report_html with every requiredChartIds host. Adapt density to THE ask. Do not invent numbers. If grounding rejects, fix cited spans and retry set_report_html once — server auto-templates only after two rejects.'
      const result = await runPremiumReportAgent({
        systemPrompt: buildDesignerSystemPrompt({
          clubName: club.name,
          route,
          language: args.language,
          packHint: designPack.promptHint,
          policy,
          displayRange,
          wellnessScalesLine: wellnessScalesLine || undefined,
        }),
        userPrompt: JSON.stringify({
          stage: 'designer',
          mode: designerMode,
          coach: args.prompt.trim(),
          pack: { id: designPack.id, hint: designPack.promptHint },
          wellnessScales,
          chartCount,
          displayRange,
          request: envelope,
          instruction: designerInstruction,
        }),
        history: [],
        tools,
        state: agentState,
        maxIterations: softRebindRepair
          ? Math.min(8, REPORT_V4_DESIGNER_MAX_ITERATIONS)
          : REPORT_V4_DESIGNER_MAX_ITERATIONS,
        forceAnswerAt: softRebindRepair
          ? Math.min(6, REPORT_V4_DESIGNER_FORCE_ANSWER_AT)
          : REPORT_V4_DESIGNER_FORCE_ANSWER_AT,
        minIterations: REPORT_V4_DESIGNER_MIN_ITERATIONS,
        maxEndTurnNudges: softRebindRepair ? 2 : 4,
        continuePrompt: REPORT_V4_DESIGNER_CONTINUE,
        acceptEndTurn: rejectMissingArtifact,
        maxTokens: REPORT_V4_DESIGNER_MAX_TOKENS,
        temperature: softRebindRepair ? 0.2 : 0.35,
        onIteration: onIteration('designer'),
        signal: args.signal,
      })
      addUsage(run.usage, result.usage)
      run.iterations += result.iterations
      logReportV4AgentTotal({
        agent: 'designer',
        iterations: result.iterations,
        durationSec: sumSecs('designer'),
        usage: result.usage,
        detail: `htmlBytes=${run.htmlArtifact?.length ?? 0} freeArtifact=${Boolean(run.htmlArtifact?.includes('data-artifact="free"'))} softRepair=${softRebindRepair}`,
      })
      logger.info(
        {
          htmlBytes: run.htmlArtifact?.length ?? 0,
          freeArtifact: Boolean(run.htmlArtifact?.includes('data-artifact="free"')),
          iterations: result.iterations,
          softRebindRepair,
        },
        'report_v4.designer_done'
      )

      if (artifactHtmlLooksValid(run.htmlArtifact)) {
        if (run.htmlArtifact?.includes('data-artifact="free"')) {
          const hosted = countPresentChartHosts(run.htmlArtifact, charts)
          const injectedGuess = Math.max(0, chartCount - hosted)
          if (
            freeArtifactTooThinForCharts({
              chartCount,
              injectedCharts: injectedGuess,
              presentHosts: hosted,
            })
          ) {
            logger.warn(
              {
                reason: 'thin_free_artifact',
                charts: chartCount,
                presentHosts: hosted,
                injectedGuess,
              },
              'report_v4.designer_fallback_template'
            )
            await recoverTemplateArtifact('thin_free_artifact')
          }
        }
      } else {
        const tablesNow = collectArtifactTables(run.document).length
        if (chartCount > 0 || tablesNow > 0) {
          logger.warn(
            {
              reason: 'designer_ended_without_html',
              charts: chartCount,
              tables: tablesNow,
              softRebindRepair,
            },
            'report_v4.designer_fallback_template'
          )
          await recoverTemplateArtifact('designer_ended_without_html')
        }
      }
    } else if (!artifactHtmlLooksValid(run.htmlArtifact)) {
      logger.warn(
        {
          reason: 'soft_rebind_invalid_html',
          preserveCanvas: true,
          charts: chartCount,
        },
        'report_v4.designer_soft_rebind_invalid'
      )
    }
  }

  if (needsFreshArtifact && !artifactHtmlLooksValid(run.htmlArtifact)) {
    const chartsLeft = collectArtifactCharts(run.document, heatScales).length
    const tablesLeft = collectArtifactTables(run.document).length
    const briefSignals = run.reportBrief?.signals.length ?? 0
    if (chartsLeft > 0 || tablesLeft > 0) {
      logger.warn(
        {
          reason: 'orchestrator_post_designer_fallback',
          charts: chartsLeft,
          tables: tablesLeft,
          domains,
          briefSignals,
          multiSectionAsk,
          preserveCanvas,
        },
        'report_v4.designer_fallback_template'
      )
      await recoverTemplateArtifact('orchestrator_post_designer_fallback')
    }
    if (!artifactHtmlLooksValid(run.htmlArtifact)) {
      if (
        chartsLeft > 0 ||
        tablesLeft > 0 ||
        briefSignals > 0 ||
        domains.length >= 2 ||
        multiSectionAsk
      ) {
        logger.error(
          {
            reason: 'designer_failed_no_usable_artifact',
            charts: chartsLeft,
            tables: tablesLeft,
            domains,
            briefSignals,
            multiSectionAsk,
            preserveCanvas,
          },
          'report_v4.designer_abort_ungrounded'
        )
        throw new Exception('Designer failed grounding / free artifact — refusing empty PDF', {
          status: 422,
        })
      }
      const emptyMessage = `For ${displayRange.from} → ${displayRange.to}, no usable data for this ask.`
      logger.warn(
        {
          reason: 'emergency_after_designer_empty',
          charts: chartsLeft,
          tables: tablesLeft,
          briefSignals,
          domains,
        },
        'report_v4.designer_fallback_template'
      )
      const emptyArtifact = finalizeMinimalEmptyArtifact({
        clubName: club.name,
        title: run.document.title || 'Staff report',
        message: emptyMessage,
        dateRange: displayRange,
        pack: designPack,
        language: args.language,
      })
      if (!emptyArtifact.ok) {
        throw new Exception(
          `Designer failed and empty artifact finalize failed: ${emptyArtifact.error}`,
          { status: 422 }
        )
      }
      run.htmlArtifact = emptyArtifact.html
    }
  }

  let htmlArtifact = run.htmlArtifact ?? ''
  if (artifactHtmlLooksValid(htmlArtifact)) {
    const insightRoster = await resolveInsightRosterPhotos({
      roster: rosterAll,
      athleteNames: collectInsightAthleteNames(run.reportBrief),
    })
    const signed = applySignedPhotosInHtml(htmlArtifact, insightRoster)
    htmlArtifact = signed.html
    if (signed.applied > 0) {
      logger.info({ applied: signed.applied }, 'report_v4.insight_photos_signed')
    }
    const nutritionStrip = stripNutritionProseFromHtml(htmlArtifact, policy.allowNutritionScope)
    htmlArtifact = nutritionStrip.html
    if (nutritionStrip.stripped > 0) {
      logger.warn({ stripped: nutritionStrip.stripped }, 'report_v4.grounding_strip_nutrition_html')
    }
  }
  run.htmlArtifact = htmlArtifact
  if (harvestDataProfile) {
    const reliability = ensureDataReliabilityBlocks(
      run.document,
      harvestDataProfile,
      args.language
    )
    run.document = reliability.document
    if (reliability.inserted) {
      logger.info(
        {
          blocks: run.document.blocks.length,
          sampleRows: harvestDataProfile.datasets.reduce((sum, row) => sum + row.rowCount, 0),
        },
        'report_v4.data_reliability_block'
      )
    }
  }
  if (artifactHtmlLooksValid(htmlArtifact) && run.document.blocks.length > 0) {
    const parity = evaluateArtifactParity(run.document, htmlArtifact)
    logger.info(
      {
        ok: parity.ok,
        issues: parity.issues.slice(0, 12),
        documentBlockCount: parity.documentBlockCount,
        htmlBlockCount: parity.htmlBlockCount,
      },
      'report_v4.artifact_parity'
    )
  }

  const deepFloor =
    Boolean(policy.monitoringPlaybook) || Boolean(multiSectionAsk) || domains.length >= 3
  const thinFree =
    !preserveCanvas &&
    !deepFloor &&
    policy.reportShape === COACH_REPORT_SHAPE.FREE &&
    domains.length <= 2
  const minCharts = thinFree || preserveCanvas
    ? 0
    : Math.min(8, Math.max(2, domains.length || 1))
  const askContract = evaluateAskContract({
    document: run.document,
    displayRange,
    policy,
    envelope: artifactEnvelope,
    domains,
    language: args.language,
    acwrStatus: acwrHarvestStatus,
    minCharts,
    htmlArtifact,
  })
  logger.info(
    {
      status: askContract.status,
      gaps: askContract.results
        .filter((row) => row.status !== 'delivered')
        .map((row) => ({ id: row.id, status: row.status })),
    },
    'report_v4.ask_contract'
  )

  if (run.templateRecoveredReason) {
    softEditPath = 'template_recovered'
    const templateRefusal = refusalFromTemplateRecovered({
      reason: run.templateRecoveredReason,
      language: args.language,
    })
    softRefusals = [...softRefusals, templateRefusal]
    softCoachMessage =
      softCoachMessage ??
      formatSoftEditPathMessage({
        path: 'template_recovered',
        language: args.language,
        detail: templateRefusal.reason,
      })
  } else if (!softEditPath) {
    softEditPath = 'full_rebuild'
  }

  let message = softCoachMessage
  if (!message && preserveCanvas && softBlocked.includes('zero_mutations')) {
    message = formatSoftEditPathMessage({ path: 'unchanged', language: args.language })
  }
  if (!message && (softEditPath === 'local' || softEditPath === 'full_rebuild')) {
    message = formatSoftEditPathMessage({
      path: softEditPath,
      language: args.language,
      detail: askContract.message,
    })
  }
  if (!message) {
    message = askContract.message
  }

  const nextSessionFocus =
    domains.length > 0 || harvestFetches.length > 0
      ? buildSessionFocus({
          prompt: args.prompt,
          domains: domains.length ? domains : harvestFetches.map((row) => row.domain),
          fetches: harvestFetches,
          displayRange,
        })
      : (args.sessionFocus ?? null)

  const summary = buildSoftRunSummary({
    envelope: artifactEnvelope,
    softApplied,
    softBlocked,
    coverage: coverageGateResult,
    acwrStatus: acwrHarvestStatus,
    pathCostClass,
    language: args.language === 'en' ? 'en' : 'fr',
    askContract,
    editPath: softEditPath,
    refusals: softRefusals,
  })

  return {
    document: run.document,
    message,
    iterations: run.iterations,
    usage: run.usage,
    iterationSecs: run.iterationSecs,
    iterationCosts: run.iterationCosts,
    html: run.htmlArtifact ?? '',
    designPack,
    route,
    sessionFocus: nextSessionFocus,
    coverage: {
      displayRange,
      fetchRange,
      domainRanges,
      domains: coverage.domains,
      populatedDomains: coverage.populatedDomains,
      emptyDomains: coverage.emptyDomains,
    },
    clarify: null,
    summary,
    pathCostClass,
  }
}
