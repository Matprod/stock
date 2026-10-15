import {
  PREMIUM_CANVAS_ASK,
  type PremiumCanvasAsk,
  type PremiumCanvasAskKind,
} from '#constants/premium_report.constants'
import { JEV_ROUTER_MODEL } from '#constants/question_router.constants'
import type { PremiumDomain } from '#constants/premium_report_domains'
import {
  buildCanvasAskChoice,
  resolveCanvasAsk,
} from '#services/premium_report/jev_canvas_ask'
import { noul, type TypeSafeClient } from '#services/jev_service'
import { invokeHaikuJson } from '#services/report_v4/haiku_json'
import { runIntentClassifier } from '#services/report_v4/jev_guard'
import type { ReportV4SessionFocus } from '#services/report_v4/session_focus'
import {
  compactSoftCanvasInventoryForRouter,
  type SoftCanvasInventory,
} from '#services/report_v4/soft_canvas_inventory'
import { noulScore } from '#utils/jev_answers'
import type { EditRouteFlags, ReportEditPlan } from '#services/report_v4/edit_route_finish'
import { REPORT_V4_MICRO_EDIT_KINDS } from '#services/report_v4/report_v4_constants'

const NOUL_TRUE = 0.55

const NO_FETCH_ASK_KINDS = new Set<PremiumCanvasAskKind>([
  PREMIUM_CANVAS_ASK.MICRO_EDIT,
  PREMIUM_CANVAS_ASK.REMOVE,
  PREMIUM_CANVAS_ASK.RESHAPE,
  PREMIUM_CANVAS_ASK.SPLIT,
  PREMIUM_CANVAS_ASK.DUPLICATE,
  PREMIUM_CANVAS_ASK.EXPLAIN,
  PREMIUM_CANVAS_ASK.NONE,
])

export const planFromAsk = (
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

export const wipeEditPlan = (
  hasExistingCanvas: boolean,
  routeFlags: EditRouteFlags
): ReportEditPlan =>
  planFromAsk(
    { kind: PREMIUM_CANVAS_ASK.NEW_VIZ, provider: 'skip' },
    hasExistingCanvas,
    true,
    true,
    false,
    { ...routeFlags, wipe: true }
  )

const buildEditState = (args: {
  prompt: string
  periodChanged: boolean
  additive: boolean
  scopedPeriod: boolean
  design: boolean
  windowFetchDomains: PremiumDomain[]
  sessionFocus?: ReportV4SessionFocus | null
  inventory?: SoftCanvasInventory | null
}) => ({
  prompt: args.prompt.slice(0, 3500),
  hasExistingCanvas: 'true',
  periodChanged: args.periodChanged ? 'true' : 'false',
  additiveHint: args.additive ? 'true' : 'false',
  scopedPeriodHint: args.scopedPeriod ? 'true' : 'false',
  designHint: args.design ? 'true' : 'false',
  windowFetchDomains: args.windowFetchDomains.join(',') || 'none',
  priorFocusDomains: args.sessionFocus?.domains.join(',') || 'none',
  canvasInventory: args.inventory
    ? JSON.stringify(compactSoftCanvasInventoryForRouter(args.inventory)).slice(0, 4500)
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
})

const classifyEditWithJev = async (
  client: TypeSafeClient,
  editState: ReturnType<typeof buildEditState>
) => {
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

const classifyEditWithHaiku = async (
  editState: ReturnType<typeof buildEditState>
): Promise<Record<string, unknown>> => {
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
  const kind = Object.values(PREMIUM_CANVAS_ASK).includes(raw.canvas_ask as PremiumCanvasAskKind)
    ? (raw.canvas_ask as PremiumCanvasAskKind)
    : PREMIUM_CANVAS_ASK.MICRO_EDIT
  return {
    canvasAsk: { choice: kind, confidence: 0.7 },
    needs_fetch: { noul: raw.needs_fetch ? 0.9 : 0.1 },
    enrich_existing: { noul: raw.enrich_existing ? 0.9 : 0.1 },
    keep_prior_display: { noul: raw.keep_prior_display ? 0.9 : 0.1 },
  }
}

export const resolveCanvasEditFromClassifier = async (args: {
  prompt: string
  periodChanged: boolean
  additive: boolean
  scopedPeriod: boolean
  design: boolean
  multiSectionAsk?: boolean
  windowFetchDomains: PremiumDomain[]
  sessionFocus?: ReportV4SessionFocus | null
  inventory?: SoftCanvasInventory | null
  routeFlags: EditRouteFlags
  forceFetch: boolean
}): Promise<{ plan: ReportEditPlan; enrichExisting: boolean }> => {
  const editState = buildEditState(args)
  const { value: answers } = await runIntentClassifier({
    context: 'edit_route',
    jev: (client) => classifyEditWithJev(client, editState),
    haiku: () => classifyEditWithHaiku(editState),
  })

  const canvasAsk = resolveCanvasAsk(answers, 'canvasAsk', PREMIUM_CANVAS_ASK.MICRO_EDIT)
  let kind = canvasAsk.kind
  if (
    args.routeFlags.partialProse &&
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
  const aesthetic = args.routeFlags.aesthetic
  const softDataAsk =
    args.periodChanged ||
    args.scopedPeriod ||
    args.additive ||
    enrichExisting ||
    Boolean(args.multiSectionAsk) ||
    args.forceFetch
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
    ((args.additive || args.scopedPeriod) && (args.periodChanged || args.scopedPeriod))
  return {
    plan: planFromAsk(canvasAsk, true, false, needsFetchHint, keepPrior, args.routeFlags),
    enrichExisting,
  }
}
