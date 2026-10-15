import logger from '@adonisjs/core/services/logger'
import { PREMIUM_CANVAS_ASK } from '#constants/premium_report.constants'
import { elapsedSec } from '#services/premium_report/premium_report_log'
import { resolveSoftEditOpsAsync, type SoftEditOpsPlan } from '#services/report_v4/soft_edit_ops'
import type { SoftCanvasInventory } from '#services/report_v4/soft_canvas_inventory'
import type { PremiumCanvasAsk } from '#constants/premium_report.constants'
import { REPORT_V4_MICRO_EDIT_KINDS } from '#services/report_v4/report_v4_constants'

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

type FinishLogCtx = {
  started: number
  inventory: SoftCanvasInventory | null
  additive: boolean
  scopedPeriod: boolean
  design: boolean
  periodChanged: boolean
  multiSectionAsk: boolean
  wipeCanvas: boolean
  wipeReason: 'no_existing_canvas' | 'wipe_rebuild_ask' | null
}

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

const logEditPlan = (plan: ReportEditPlan, ctx: FinishLogCtx): void => {
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
      inventory: ctx.inventory
        ? {
            hasToc: ctx.inventory.hasToc,
            charts: ctx.inventory.chartCount,
            tables: ctx.inventory.tableCount,
            sections: ctx.inventory.sectionTitles.length,
          }
        : null,
      additive: ctx.additive,
      scopedPeriod: ctx.scopedPeriod,
      design: ctx.design,
      periodChanged: ctx.periodChanged,
      multiSectionAsk: ctx.multiSectionAsk,
      wipeCanvas: ctx.wipeCanvas,
      wipeReason: ctx.wipeReason,
      routeFlags: plan.routeFlags,
      provider: plan.provider,
      durationSec: elapsedSec(ctx.started),
    },
    'report_v4.edit_route'
  )
}

export const finishReportEditPlan = async (args: {
  plan: ReportEditPlan
  prompt: string
  inventory: SoftCanvasInventory | null
  logCtx: FinishLogCtx
  enrichExisting?: boolean
}): Promise<ReportEditPlan> => {
  let next = await applySoftOpsToPlan(args.plan, args.prompt, args.inventory)
  if (args.enrichExisting) {
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
      : await resolveSoftEditOpsAsync({ prompt: args.prompt, inventory: args.inventory })
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
  logEditPlan(next, args.logCtx)
  return next
}
