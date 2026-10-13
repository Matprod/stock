import type { PremiumReportDocument } from '#contracts/premium_report'
import {
  classifySoftEditIntentFlags,
  type SoftEditIntentFlags,
} from '#services/report_v4/classify_soft_edit_intent'
import { classifySoftRemoveQueries } from '#services/report_v4/classify_soft_remove_queries'
import {
  applySoftEditorialToHtml,
  type SoftEditorialResult,
} from '#services/report_v4/soft_edit_editorial'
import type { SoftCanvasInventory } from '#services/report_v4/soft_canvas_inventory'
import type { AppLanguage } from '#utils/localize'

export type SoftEditOp =
  | { type: 'remove_section'; query: string }
  | { type: 'ensure_toc' }
  | { type: 'strip_empty_sections' }

export type SoftEditOpsPlan = {
  ops: SoftEditOp[]
  editorialOnly: boolean
  needsAnalyst: boolean
  needsFetch: boolean
  removeQueries: string[]
  ensureToc: boolean
  hasDataOps: boolean
  restoreSheets: boolean
  addSectionProse: boolean
  additiveSoft: boolean
  layoutRepair: boolean
  wantsTeamMean: boolean
  enrichExistingCharts: boolean
  chartOptionsPatched?: number
}

export const softEditOpsFromIntent = (
  flags: SoftEditIntentFlags,
  removeQueries: string[] = []
): SoftEditOpsPlan => {
  const ops: SoftEditOp[] = []
  const queries = flags.wantsRemove ? [...new Set(removeQueries.filter((q) => q.trim().length >= 3))] : []
  for (const query of queries) {
    ops.push({ type: 'remove_section', query })
  }
  if (flags.wantsToc) ops.push({ type: 'ensure_toc' })
  if (flags.stripEmpty) ops.push({ type: 'strip_empty_sections' })

  const wantsTeamMean = flags.wantsTeamMean
  const enrichExistingCharts = flags.enrichExistingCharts && !wantsTeamMean
  const residualNeedsAnalyst = flags.residualNeedsAnalyst
  const restoreSheets = flags.restoreSheets && !flags.layoutRepair
  const addSectionProse = flags.addSectionProse
  const layoutRepair = flags.layoutRepair

  const hasEditorial = ops.some(
    (op) =>
      op.type === 'remove_section' || op.type === 'ensure_toc' || op.type === 'strip_empty_sections'
  )
  const hasData = wantsTeamMean || enrichExistingCharts
  const needsAnalyst =
    hasData ||
    residualNeedsAnalyst ||
    restoreSheets ||
    addSectionProse ||
    layoutRepair ||
    (!hasEditorial && !hasData)
  const editorialOnly =
    hasEditorial &&
    !hasData &&
    !residualNeedsAnalyst &&
    !restoreSheets &&
    !addSectionProse &&
    !layoutRepair
  const needsFetch = hasData || restoreSheets
  const additiveSoft =
    !layoutRepair && !enrichExistingCharts && (restoreSheets || addSectionProse || wantsTeamMean)

  return {
    ops,
    editorialOnly,
    needsAnalyst: editorialOnly ? false : needsAnalyst,
    needsFetch,
    removeQueries: queries,
    ensureToc: flags.wantsToc,
    hasDataOps: hasData,
    restoreSheets,
    addSectionProse,
    additiveSoft,
    layoutRepair,
    wantsTeamMean,
    enrichExistingCharts,
  }
}

export const resolveSoftEditOps = (
  flags: SoftEditIntentFlags,
  _prompt?: string,
  _inventory?: SoftCanvasInventory | null,
  removeQueries: string[] = []
): SoftEditOpsPlan => softEditOpsFromIntent(flags, removeQueries)

export const resolveSoftEditOpsAsync = async (args: {
  prompt: string
  inventory?: SoftCanvasInventory | null
  language?: AppLanguage
}): Promise<SoftEditOpsPlan> => {
  const { flags } = await classifySoftEditIntentFlags({
    prompt: args.prompt,
    language: args.language,
  })
  const removeQueries = flags.wantsRemove
    ? (
        await classifySoftRemoveQueries({
          prompt: args.prompt,
          inventory: args.inventory,
          language: args.language,
        })
      ).queries
    : []
  return softEditOpsFromIntent(flags, removeQueries)
}

export const applyResolvedSoftEditorial = (args: {
  html: string
  document: PremiumReportDocument
  ops: SoftEditOpsPlan
  language: AppLanguage
  clubName?: string
  reportTitle?: string
}): SoftEditorialResult =>
  applySoftEditorialToHtml({
    html: args.html,
    document: args.document,
    removeQueries: args.ops.removeQueries,
    ensureToc: args.ops.ensureToc,
    stripEmpty: args.ops.ops.some((op) => op.type === 'strip_empty_sections'),
    language: args.language,
    clubName: args.clubName,
    reportTitle: args.reportTitle,
  })
