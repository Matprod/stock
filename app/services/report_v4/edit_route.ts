import logger from '@adonisjs/core/services/logger'
import type { PremiumDomain } from '#constants/premium_report_domains'
import { JEV_ROUTER_MODEL } from '#constants/question_router.constants'
import { noul, type TypeSafeClient } from '#services/jev_service'
import { invokeHaikuJson } from '#services/report_v4/haiku_json'
import { runIntentClassifier } from '#services/report_v4/jev_guard'
import type { ReportV4SessionFocus } from '#services/report_v4/session_focus'
import type { SoftCanvasInventory } from '#services/report_v4/soft_canvas_inventory'
import { noulScore } from '#utils/jev_answers'
import {
  resolveCanvasEditFromClassifier,
  wipeEditPlan,
} from '#services/report_v4/edit_route_canvas_ask'
import {
  finishReportEditPlan,
  type EditRouteFlags,
  type ReportEditPlan,
} from '#services/report_v4/edit_route_finish'

export type { EditRouteFlags, ReportEditPlan }

const NOUL_TRUE = 0.55

const boolFromUnknown = (value: unknown): boolean => {
  if (typeof value === 'boolean') return value
  if (typeof value === 'string') return value.trim().toLowerCase() === 'true'
  if (typeof value === 'number') return value >= NOUL_TRUE
  return false
}

const editRouteFlagsFromHaikuJson = (raw: Record<string, unknown>): EditRouteFlags => ({
  wipe: boolFromUnknown(raw.wipe),
  additive: boolFromUnknown(raw.additive),
  scopedPeriod: boolFromUnknown(raw.scoped_period),
  design: boolFromUnknown(raw.design),
  aesthetic: boolFromUnknown(raw.aesthetic),
  partialProse: boolFromUnknown(raw.partial_prose),
  recommendationStrip: boolFromUnknown(raw.recommendation_strip),
})

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

const normalizeRouteFlags = (
  classifiedFlags: EditRouteFlags,
  hasExistingCanvas: boolean
): EditRouteFlags => {
  let routeFlags: EditRouteFlags = { ...classifiedFlags }
  if (!hasExistingCanvas) {
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
  return routeFlags
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

  const routeFlags = normalizeRouteFlags(classifiedFlags, args.hasExistingCanvas)
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

  const logCtx = {
    started,
    inventory,
    additive,
    scopedPeriod,
    design,
    periodChanged: args.periodChanged,
    multiSectionAsk: Boolean(args.multiSectionAsk),
    wipeCanvas,
    wipeReason,
  }

  const finish = (plan: ReportEditPlan, enrichExisting?: boolean) =>
    finishReportEditPlan({
      plan,
      prompt: args.prompt,
      inventory,
      logCtx,
      enrichExisting,
    })

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

  const { plan, enrichExisting } = await resolveCanvasEditFromClassifier({
    prompt: args.prompt,
    periodChanged: args.periodChanged,
    additive,
    scopedPeriod,
    design,
    multiSectionAsk: args.multiSectionAsk,
    windowFetchDomains,
    sessionFocus: args.sessionFocus,
    inventory,
    routeFlags,
    forceFetch,
  })
  return finish(plan, enrichExisting)
}
