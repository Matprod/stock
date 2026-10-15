import logger from '@adonisjs/core/services/logger'
import { Exception } from '@adonisjs/core/exceptions'
import type { PremiumDomain } from '#constants/premium_report_domains'
import { artifactHtmlLooksValid } from '#services/report_v4/artifact_html'
import { formatClubSeasonsBrief } from '#services/report_v4/club_seasons'
import { resolveDesignPackFromPrompt } from '#services/report_v4/design/report_design_pack'
import { buildFetchRange, resolveClubReportTimeZone } from '#services/report_v4/lookback_range'
import type { ReportV4OrchestratorDeps } from '#services/report_v4/orchestrator/deps'
import type {
  FramedAsk,
  ReportV4OrchestratorArgs,
} from '#services/report_v4/orchestrator/types'
import { formatTimeRangeBrief } from '#services/report_v4/orchestrator_helpers'
import { clubPositionCatalog } from '#services/report_v4/position_catalog'
import { ensureTimeSeriesDomainWindows, unionCoverRange } from '#services/report_v4/prompt_scope'
import { priorUserAsks } from '#services/report_v4/session_focus'
import { buildSoftCanvasInventory } from '#services/report_v4/soft_canvas_inventory'

export const frameAsk = async (
  args: ReportV4OrchestratorArgs,
  d: ReportV4OrchestratorDeps
): Promise<FramedAsk> => {
  const club = await d.findClub(args.clubId)
  if (!club) throw new Exception('Club not found', { status: 404 })

  const { pack: designPackFromPrompt, explicit: designPackExplicit } = resolveDesignPackFromPrompt(
    args.prompt,
    args.designPackId
  )
  const clubSeasons = await d.loadClubSeasons(args.clubId)
  const clubSeasonsBrief = formatClubSeasonsBrief(clubSeasons)
  const priorAsks = priorUserAsks(args.history, 2)
  const clubTimeZone = resolveClubReportTimeZone(club)
  const analyzed = await d.analyzeRequest(args.prompt, {
    seasons: clubSeasons,
    sessionFocus: args.sessionFocus,
    priorUserAsks: priorAsks,
    timeZone: clubTimeZone,
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
  const edit = await d.resolveReportEditPlan({
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
  const priorHtml =
    preserveCanvas && typeof args.html === 'string' && artifactHtmlLooksValid(args.html)
      ? args.html
      : null
  const needsFreshArtifact = !preserveCanvas || !priorHtml
  const softRebindRepair = false
  const softEditorialAppliedEarly = false
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
  const rosterAll = await d.loadClubRoster(args.clubId, { activeRanges: rosterActiveRanges })
  logger.info(
    {
      athletes: rosterAll.length,
      ranges: rosterActiveRanges,
    },
    'report_v4.roster_active_window'
  )
  const clubPostes = clubPositionCatalog(rosterAll)
  const athleteIds = rosterAll.map((row) => row.id)

  return {
    club,
    designPackFromPrompt,
    designPackExplicit,
    clubSeasons,
    clubSeasonsBrief,
    askDomains,
    periodFollowUp,
    promptWindows,
    multiSectionAsk,
    explicitPeriod,
    earlyFetchDomains,
    inheritedFocusDomains,
    softInventory,
    edit,
    preserveCanvas,
    needsFetch,
    isMicroSoft,
    priorHtml,
    needsFreshArtifact,
    softRebindRepair,
    softEditorialAppliedEarly,
    priorChartCount,
    displayRange,
    domainRanges,
    fetchWindows,
    coverRange,
    fetchRange,
    timeRangesBrief,
    rosterAll,
    clubPostes,
    athleteIds,
  }
}
