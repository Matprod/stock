import logger from '@adonisjs/core/services/logger'
import { PREMIUM_CANVAS_ASK } from '#constants/premium_report.constants'
import {
  listSoftTargetCandidates,
  resolveSoftEditTargets,
} from '#services/premium_report/soft_edit_targets'
import type { PremiumDomain } from '#constants/premium_report_domains'
import type { PremiumReportDocument } from '#contracts/premium_report'
import type { FramedAsk } from '#services/report_v4/orchestrator/types'
import type { SoftEditOpsPlan } from '#services/report_v4/soft_edit_ops'

export const resolveSoftBlockTargets = (params: {
  prompt: string
  preserveCanvas: boolean
  needsFetch: boolean
  softOps: SoftEditOpsPlan | null
  softEditorialOnly: boolean
  edit: FramedAsk['edit']
  document: PremiumReportDocument
  askDomains: PremiumDomain[]
}): {
  softAllowBlockIds: Set<string> | undefined
  softTargetsUnresolved: boolean
  softTargetCandidates: Array<{ title: string }>
} => {
  const { prompt, preserveCanvas, needsFetch, softOps, softEditorialOnly, edit, document, askDomains } = params
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
      ? resolveSoftEditTargets(prompt, document, { askDomains })
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
    ? listSoftTargetCandidates(prompt, document, 8, { askDomains })
    : []
  if (softTargetsUnresolved) {
    logger.warn(
      {
        canvasAsk: edit.canvasAsk.kind,
        blockCount: document.blocks.length,
        promptPreview: prompt.slice(0, 160),
        candidates: softTargetCandidates.map((row) => row.title),
        failClosed: false,
      },
      'soft_targets_unresolved'
    )
  }
  return { softAllowBlockIds, softTargetsUnresolved, softTargetCandidates }
}
