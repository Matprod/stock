import logger from '@adonisjs/core/services/logger'
import {
  PREMIUM_CANVAS_ASK,
  type PremiumCanvasAsk,
  type PremiumCanvasAskKind,
} from '#constants/premium_report.constants'
import type { PremiumDomain } from '#constants/premium_report_domains'
import { JEV_ROUTER_MODEL } from '#constants/question_router.constants'
import {
  buildCanvasAskChoice,
  resolveCanvasAsk,
} from '#services/premium_report/jev_canvas_ask'
import { elapsedSec } from '#services/premium_report/premium_report_log'
import { noul, type TypeSafeClient } from '#services/jev_service'
import { invokeHaikuJson } from '#services/report_v4/haiku_json'
import { runIntentClassifier } from '#services/report_v4/jev_guard'
import { REPORT_V4_MICRO_EDIT_KINDS } from '#services/report_v4/report_v4_constants'
import type { ReportV4SessionFocus } from '#services/report_v4/session_focus'
import {
  compactSoftCanvasInventoryForRouter,
  type SoftCanvasInventory,
} from '#services/report_v4/soft_canvas_inventory'
import { resolveSoftEditOpsAsync, type SoftEditOpsPlan } from '#services/report_v4/soft_edit_ops'
import { noulScore } from '#utils/jev_answers'

export type EditRouteFlags = {
  wipe: boolean
  additive: boolean
  scopedPeriod: boolean
  design: boolean
  aesthetic: boolean
  partialProse: boolean
  recommendationStrip: boolean
}

export type ReportEditPlan = {
  canvasAsk: PremiumCanvasAsk
  preserveCanvas: boolean
  needsFetch: boolean
  isMicro: boolean
  keepPriorDisplayRange: boolean
  provider: PremiumCanvasAsk['provider']
  softOps: SoftEditOpsPlan | null
  routeFlags: EditRouteFlags
}

const NOUL_TRUE = 0.55

const boolFromUnknown = (value: unknown): boolean => {
  if (typeof value === 'boolean') return value
  if (typeof value === 'string') return value.trim().toLowerCase() === 'true'
  if (typeof value === 'number') return value >= NOUL_TRUE
  return false
}

export const editRouteFlagsFromHaikuJson = (raw: Record<string, unknown>): EditRouteFlags => ({
  wipe: boolFromUnknown(raw.wipe),
  additive: boolFromUnknown(raw.additive),
  scopedPeriod: boolFromUnknown(raw.scoped_period),
  design: boolFromUnknown(raw.design),
  aesthetic: boolFromUnknown(raw.aesthetic),
  partialProse: boolFromUnknown(raw.partial_prose),
  recommendationStrip: boolFromUnknown(raw.recommendation_strip),
})

const NO_FETCH_ASK_KINDS = new Set<PremiumCanvasAskKind>([
  PREMIUM_CANVAS_ASK.MICRO_EDIT,
  PREMIUM_CANVAS_ASK.REMOVE,
  PREMIUM_CANVAS_ASK.RESHAPE,
  PREMIUM_CANVAS_ASK.SPLIT,
  PREMIUM_CANVAS_ASK.DUPLICATE,
  PREMIUM_CANVAS_ASK.EXPLAIN,
  PREMIUM_CANVAS_ASK.NONE,
])

const applySoftOpsToPlan = async (
  plan: ReportEditPlan,
  prompt: string,
  inventory?: SoftCanvasInventory | null
): Promise<ReportEditPlan> => {
  if (!plan.preserveCanvas) return { ...plan, softOps: null }
  const softOps = await resolveSoftEditOpsAsync({ prompt, inventory })
  if (!softOps) return { ...plan, softOps: null }

  let { needsFetch, isMicro, canvasAsk } = plan
  if (softOps.editorialOnly) {
    needsFetch = false
    isMicro = true
    if (softOps.removeQueries.length > 0 && softOps.ops.every((op) => op.type !== 'ensure_toc')) {
      canvasAsk = { ...canvasAsk, kind: PREMIUM_CANVAS_ASK.REMOVE }
    } else if (softOps.ensureToc && softOps.removeQueries.length === 0) {
      canvasAsk = { ...canvasAsk, kind: PREMIUM_CANVAS_ASK.MICRO_EDIT }
    } else if (softOps.removeQueries.length > 0) {
      canvasAsk = { ...canvasAsk, kind: PREMIUM_CANVAS_ASK.REMOVE }
    }
  } else if (softOps.layoutRepair || softOps.enrichExistingCharts) {
    needsFetch = softOps.needsFetch || softOps.enrichExistingCharts
    isMicro = false
    canvasAsk = { ...canvasAsk, kind: PREMIUM_CANVAS_ASK.RESHAPE }
  } else if (softOps.wantsTeamMean && !softOps.additiveSoft) {
    needsFetch = softOps.needsFetch
    isMicro = false
    canvasAsk = { ...canvasAsk, kind: PREMIUM_CANVAS_ASK.RESHAPE }
  } else if (softOps.needsFetch || softOps.additiveSoft) {
    if (softOps.needsFetch) needsFetch = true
    isMicro = false
    if (
      softOps.additiveSoft &&
      (canvasAsk.kind === PREMIUM_CANVAS_ASK.MICRO_EDIT ||
        canvasAsk.kind === PREMIUM_CANVAS_ASK.NONE ||
        canvasAsk.kind === PREMIUM_CANVAS_ASK.REMOVE)
    ) {
      canvasAsk = {
        ...canvasAsk,
        kind: softOps.wantsTeamMean ? PREMIUM_CANVAS_ASK.RESHAPE : PREMIUM_CANVAS_ASK.NEW_VIZ,
      }
    }
  }

  return {
    ...plan,
    canvasAsk,
    needsFetch,
    isMicro:
      plan.preserveCanvas && !needsFetch && REPORT_V4_MICRO_EDIT_KINDS.has(canvasAsk.kind)
        ? true
        : isMicro && plan.preserveCanvas && !needsFetch,
    softOps,
  }
}

const planFromAsk = (
  canvasAsk: PremiumCanvasAsk,
  hasExistingCanvas: boolean,
  wipeCanvas: boolean,
  needsFetchHint: boolean,
  keepPriorDisplayRange: boolean,
  routeFlags: EditRouteFlags
): ReportEditPlan => {
  const preserveCanvas = hasExistingCanvas && !wipeCanvas
  const needsFetch =
    !preserveCanvas || canvasAsk.kind === PREMIUM_CANVAS_ASK.NEW_VIZ || needsFetchHint
  const isMicro = preserveCanvas && !needsFetch && REPORT_V4_MICRO_EDIT_KINDS.has(canvasAsk.kind)
  return {
    canvasAsk,
    preserveCanvas,
    needsFetch,
    isMicro,
    keepPriorDisplayRange: preserveCanvas && keepPriorDisplayRange,
    provider: canvasAsk.provider,
    softOps: null,
    routeFlags,
  }
}

const wipeEditPlan = (hasExistingCanvas: boolean, routeFlags: EditRouteFlags): ReportEditPlan =>
  planFromAsk(
    { kind: PREMIUM_CANVAS_ASK.NEW_VIZ, provider: 'skip' },
    hasExistingCanvas,
    true,
    true,
    false,
    { ...routeFlags, wipe: true }
  )

export const needsFetchFromSignals = (args: {
  aesthetic: boolean
  design: boolean
  additive: boolean
  scopedPeriod: boolean
  periodChanged: boolean
  multiSectionAsk: boolean
  windowFetchDomains: PremiumDomain[]
  askDomains?: PremiumDomain[]
  sessionFocus: ReportV4SessionFocus | null | undefined
}): boolean => {
  if (args.aesthetic) return false
  if (args.additive || args.scopedPeriod || args.periodChanged || args.multiSectionAsk) return true
  if (args.windowFetchDomains.length > 0) return true
  if ((args.askDomains ?? []).length > 0) return true
  if (args.sessionFocus?.domains.length && !args.design) return true
  return false
}

/** @deprecated Use needsFetchFromSignals */
export const heuristicNeedsFetch = needsFetchFromSignals

const classifyRouteFlagsWithJev = async (
  client: TypeSafeClient,
  prompt: string,
  hasExistingCanvas: boolean
): Promise<EditRouteFlags> => {
  const response = await client.systemOne({
    model: JEV_ROUTER_MODEL,
    state: {
      prompt: prompt.slice(0, 3500),
      hasExistingCanvas: hasExistingCanvas ? 'true' : 'false',
      note: [
        'Classify follow-up routing flags for an existing staff report canvas.',
        'wipe: full rebuild / new report / replace whole report / change report period wholesale.',
        'additive: append/include new charts/sections onto existing canvas.',
        'scoped_period: domain ask with a period window (keep prior display often).',
        'design: design/style/color/layout polish.',
        'aesthetic: polish-only, no new data fetch.',
        'partial_prose: trim/edit prose inside a block while keeping surrounding content.',
        'recommendation_strip: remove recommendation text specifically.',
      ].join(' '),
    },
    questions: {
      wipe: noul('Should the canvas be wiped and rebuilt from scratch?', {
        true: 'Full rebuild / new report',
        false: 'Edit existing canvas',
      }),
      additive: noul('Is this an additive follow-up (add/append/include onto existing)?', {
        true: 'Additive soft/new viz on canvas',
        false: 'Not additive',
      }),
      scoped_period: noul(
        'Is this a scoped domain+period follow-up on the existing report?',
        {
          true: 'Domain + period scoped edit',
          false: 'Not scoped period',
        }
      ),
      design: noul('Is this primarily a design/style/color/layout follow-up?', {
        true: 'Design polish',
        false: 'Not design-only',
      }),
      aesthetic: noul('Is this aesthetic-only (no new data fetch needed)?', {
        true: 'Aesthetic only',
        false: 'May need data',
      }),
      partial_prose: noul(
        'Is this a partial prose edit (trim text/recommendations while keeping other content)?',
        {
          true: 'Partial prose trim',
          false: 'Not partial prose',
        }
      ),
      recommendation_strip: noul('Does the coach ask to strip recommendation text?', {
        true: 'Strip recommendations',
        false: 'Not recommendation strip',
      }),
    },
  })
  const answers = response.answers as Record<string, unknown>
  return {
    wipe: noulScore(answers, 'wipe') >= NOUL_TRUE,
    additive: noulScore(answers, 'additive') >= NOUL_TRUE,
    scopedPeriod: noulScore(answers, 'scoped_period') >= NOUL_TRUE,
    design: noulScore(answers, 'design') >= NOUL_TRUE,
    aesthetic: noulScore(answers, 'aesthetic') >= NOUL_TRUE,
    partialProse: noulScore(answers, 'partial_prose') >= NOUL_TRUE,
    recommendationStrip: noulScore(answers, 'recommendation_strip') >= NOUL_TRUE,
  }
}

const classifyRouteFlagsWithHaiku = async (prompt: string): Promise<EditRouteFlags> => {
  const raw = await invokeHaikuJson<Record<string, unknown>>({
    system: [
      'Classify coach follow-up routing flags for an existing staff report.',
      'Respond ONLY with JSON booleans:',
      '{"wipe":false,"additive":false,"scoped_period":false,"design":false,"aesthetic":false,"partial_prose":false,"recommendation_strip":false}',
    ].join(' '),
    user: `Coach ask:\n${prompt.slice(0, 3500)}`,
  })
  return editRouteFlagsFromHaikuJson(raw)
}

export const resolveReportEditPlan = async (args: {
  prompt: string
  hasExistingCanvas: boolean
  periodChanged: boolean
  multiSectionAsk?: boolean
  inventory?: SoftCanvasInventory | null
  sessionFocus?: ReportV4SessionFocus | null
  windowFetchDomains?: PremiumDomain[]
  askDomains?: PremiumDomain[]
}): Promise<ReportEditPlan> => {
  const started = Date.now()
  const inventory = args.inventory ?? null
  const windowFetchDomains = args.windowFetchDomains ?? []
  const askDomains = args.askDomains ?? []

  const { value: classifiedFlags } = await runIntentClassifier({
    context: 'edit_route_flags',
    jev: (client) => classifyRouteFlagsWithJev(client, args.prompt, args.hasExistingCanvas),
    haiku: () => classifyRouteFlagsWithHaiku(args.prompt),
  })

  let routeFlags: EditRouteFlags = { ...classifiedFlags }
  if (!args.hasExistingCanvas) {
    routeFlags = { ...routeFlags, wipe: true }
  }
  if (routeFlags.wipe) {
    routeFlags = {
      ...routeFlags,
      additive: false,
      scopedPeriod: false,
      aesthetic: false,
    }
  }
  if (routeFlags.aesthetic && (routeFlags.additive || routeFlags.scopedPeriod)) {
    routeFlags = { ...routeFlags, aesthetic: false }
  }

  const additive = args.hasExistingCanvas && routeFlags.additive
  const scopedPeriod = args.hasExistingCanvas && routeFlags.scopedPeriod
  const design = args.hasExistingCanvas && routeFlags.design
  const wipeReason: 'no_existing_canvas' | 'wipe_rebuild_ask' | null = !args.hasExistingCanvas
    ? 'no_existing_canvas'
    : routeFlags.wipe
      ? 'wipe_rebuild_ask'
      : null
  const wipeCanvas = wipeReason !== null
  const forceFetch = needsFetchFromSignals({
    aesthetic: routeFlags.aesthetic,
    design: routeFlags.design,
    additive,
    scopedPeriod,
    periodChanged: args.periodChanged,
    multiSectionAsk: Boolean(args.multiSectionAsk),
    windowFetchDomains,
    askDomains,
    sessionFocus: args.sessionFocus,
  })

  const logPlan = (plan: ReportEditPlan) => {
    logger.info(
      {
        canvasAsk: plan.canvasAsk.kind,
        preserveCanvas: plan.preserveCanvas,
        needsFetch: plan.needsFetch,
        isMicro: plan.isMicro,
        keepPriorDisplayRange: plan.keepPriorDisplayRange,
        softOps: plan.softOps
          ? {
              editorialOnly: plan.softOps.editorialOnly,
              needsAnalyst: plan.softOps.needsAnalyst,
              needsFetch: plan.softOps.needsFetch,
              ensureToc: plan.softOps.ensureToc,
              removeQueries: plan.softOps.removeQueries,
              wantsTeamMean: plan.softOps.wantsTeamMean,
              layoutRepair: plan.softOps.layoutRepair,
              ops: plan.softOps.ops.map((op) => op.type),
            }
          : null,
        inventory: inventory
          ? {
              hasToc: inventory.hasToc,
              charts: inventory.chartCount,
              tables: inventory.tableCount,
              sections: inventory.sectionTitles.length,
            }
          : null,
        additive,
        scopedPeriod,
        design,
        periodChanged: args.periodChanged,
        multiSectionAsk: Boolean(args.multiSectionAsk),
        wipeCanvas,
        wipeReason,
        routeFlags: plan.routeFlags,
        provider: plan.provider,
        durationSec: elapsedSec(started),
      },
      'report_v4.edit_route'
    )
  }

  const finish = async (
    plan: ReportEditPlan,
    opts?: { enrichExisting?: boolean }
  ): Promise<ReportEditPlan> => {
    let next = await applySoftOpsToPlan(plan, args.prompt, inventory)
    if (opts?.enrichExisting) {
      const softOps = next.softOps
        ? {
            ...next.softOps,
            enrichExistingCharts: true,
            needsFetch: true,
            needsAnalyst: true,
            editorialOnly: false,
            additiveSoft: false,
            hasDataOps: true,
          }
        : await resolveSoftEditOpsAsync({ prompt: args.prompt, inventory })
      next = {
        ...next,
        softOps: softOps.enrichExistingCharts
          ? softOps
          : {
              ...softOps,
              enrichExistingCharts: true,
              needsFetch: true,
              needsAnalyst: true,
              editorialOnly: false,
              additiveSoft: false,
              hasDataOps: true,
            },
        needsFetch: true,
        isMicro: false,
        canvasAsk: { ...next.canvasAsk, kind: PREMIUM_CANVAS_ASK.RESHAPE },
      }
    }
    logPlan(next)
    return next
  }

  if (wipeCanvas) {
    logger.info(
      {
        wipeReason,
        hasExistingCanvas: args.hasExistingCanvas,
        periodChanged: args.periodChanged,
        multiSectionAsk: Boolean(args.multiSectionAsk),
        additive,
        scopedPeriod,
      },
      'report_v4.edit_route.wipe'
    )
    return finish(wipeEditPlan(args.hasExistingCanvas, routeFlags))
  }

  const editState = {
    prompt: args.prompt.slice(0, 3500),
    hasExistingCanvas: 'true',
    periodChanged: args.periodChanged ? 'true' : 'false',
    additiveHint: additive ? 'true' : 'false',
    scopedPeriodHint: scopedPeriod ? 'true' : 'false',
    designHint: design ? 'true' : 'false',
    windowFetchDomains: windowFetchDomains.join(',') || 'none',
    priorFocusDomains: args.sessionFocus?.domains.join(',') || 'none',
    canvasInventory: inventory
      ? JSON.stringify(compactSoftCanvasInventoryForRouter(inventory)).slice(0, 4500)
      : '',
    note: [
      'Route the coach follow-up against an existing staff-report canvas.',
      'canvasInventory lists live section/chart/table titles and ids — use it to decide REMOVE vs MICRO_EDIT vs NEW_VIZ.',
      'Prefer MICRO_EDIT for legend/label polish, design-only polish, or trimming text inside a block (remove recommendations but keep risk level / concerns).',
      'Prefer REMOVE only to delete ENTIRE sections/blocks named in canvasInventory — not partial prose trims.',
      'Prefer RESHAPE when adding metrics/series INTO existing charts (enrich), team mean overlay, or filter series — not brand-new chart sections.',
      'Prefer NEW_VIZ only when the coach wants brand-new chart/table sections (not patching existing individual-focus graphs).',
      'If windowFetchDomains or priorFocusDomains is set and the ask is period/status/data (not aesthetic), needs_fetch should be true.',
    ].join(' '),
  }

  const classifyEditWithJev = async (client: TypeSafeClient) => {
    const response = await client.systemOne({
      model: JEV_ROUTER_MODEL,
      state: editState,
      questions: {
        canvasAsk: buildCanvasAskChoice(
          'Which single canvas action best matches the coach request on the existing report?'
        ),
        needs_fetch: noul(
          'Does fulfilling this ask require fetching new datasets or building a new data-backed chart/section?',
          {
            true: 'Needs fresh data / new viz from macros',
            false: 'Can be done from the existing canvas alone',
          }
        ),
        enrich_existing: noul(
          'Does the coach ask to add metrics, series, or data INTO existing charts/graphs (enrich) rather than create brand-new chart sections?',
          {
            true: 'Patch/rebuild series on existing chart blocks',
            false: 'Not an enrich-existing-charts ask',
          }
        ),
        keep_prior_display: noul(
          'Should the report keep the prior Display period while applying a scoped/additive domain window from the new ask?',
          {
            true: 'Keep prior display; fetch/filter only the delta window',
            false: 'Rebase display to the new ask period',
          }
        ),
      },
    })
    return response.answers as Record<string, unknown>
  }

  const classifyEditWithHaiku = async (): Promise<Record<string, unknown>> => {
    const raw = await invokeHaikuJson<{
      canvas_ask?: string
      needs_fetch?: boolean
      enrich_existing?: boolean
      keep_prior_display?: boolean
    }>({
      system: [
        'Classify a coach follow-up edit on an existing staff report.',
        'Respond ONLY with JSON:',
        '{"canvas_ask":"micro_edit","needs_fetch":false,"enrich_existing":false,"keep_prior_display":false}',
        `canvas_ask one of: ${Object.values(PREMIUM_CANVAS_ASK).join(', ')}.`,
        editState.note,
      ].join(' '),
      user: JSON.stringify(editState).slice(0, 6000),
    })
    const kind = Object.values(PREMIUM_CANVAS_ASK).includes(
      raw.canvas_ask as PremiumCanvasAskKind
    )
      ? (raw.canvas_ask as PremiumCanvasAskKind)
      : PREMIUM_CANVAS_ASK.MICRO_EDIT
    return {
      canvasAsk: { choice: kind, confidence: 0.7 },
      needs_fetch: { noul: raw.needs_fetch ? 0.9 : 0.1 },
      enrich_existing: { noul: raw.enrich_existing ? 0.9 : 0.1 },
      keep_prior_display: { noul: raw.keep_prior_display ? 0.9 : 0.1 },
    }
  }

  const { value: answers } = await runIntentClassifier({
    context: 'edit_route',
    jev: classifyEditWithJev,
    haiku: classifyEditWithHaiku,
  })

  const canvasAsk = resolveCanvasAsk(answers, 'canvasAsk', PREMIUM_CANVAS_ASK.MICRO_EDIT)
  let kind = canvasAsk.kind
  if (
    routeFlags.partialProse &&
    (kind === PREMIUM_CANVAS_ASK.REMOVE || kind === PREMIUM_CANVAS_ASK.NONE)
  ) {
    kind = PREMIUM_CANVAS_ASK.MICRO_EDIT
  }
  const enrichExisting = noulScore(answers, 'enrich_existing') >= NOUL_TRUE
  if (
    enrichExisting &&
    (kind === PREMIUM_CANVAS_ASK.NEW_VIZ || kind === PREMIUM_CANVAS_ASK.NONE)
  ) {
    kind = PREMIUM_CANVAS_ASK.RESHAPE
  }
  canvasAsk.kind = kind
  const aesthetic = routeFlags.aesthetic
  const softDataAsk =
    args.periodChanged ||
    scopedPeriod ||
    additive ||
    enrichExisting ||
    Boolean(args.multiSectionAsk) ||
    forceFetch
  let needsFetchHint =
    noulScore(answers, 'needs_fetch') >= NOUL_TRUE ||
    kind === PREMIUM_CANVAS_ASK.NEW_VIZ ||
    enrichExisting ||
    softDataAsk
  if (aesthetic || (NO_FETCH_ASK_KINDS.has(kind) && !softDataAsk && !enrichExisting)) {
    needsFetchHint = false
    if (kind === PREMIUM_CANVAS_ASK.NEW_VIZ && aesthetic) {
      kind = PREMIUM_CANVAS_ASK.MICRO_EDIT
      canvasAsk.kind = kind
    }
  }
  if (
    softDataAsk &&
    !aesthetic &&
    !enrichExisting &&
    needsFetchHint &&
    (kind === PREMIUM_CANVAS_ASK.MICRO_EDIT || kind === PREMIUM_CANVAS_ASK.NONE)
  ) {
    kind = PREMIUM_CANVAS_ASK.NEW_VIZ
    canvasAsk.kind = kind
  }
  if (enrichExisting) {
    kind = PREMIUM_CANVAS_ASK.RESHAPE
    canvasAsk.kind = kind
    needsFetchHint = true
  }
  const keepPrior =
    noulScore(answers, 'keep_prior_display') >= NOUL_TRUE ||
    ((additive || scopedPeriod) && (args.periodChanged || scopedPeriod))
  return await finish(
    planFromAsk(canvasAsk, true, false, needsFetchHint, keepPrior, routeFlags),
    { enrichExisting }
  )
}
