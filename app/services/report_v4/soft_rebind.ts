import { PREMIUM_CANVAS_ASK, type PremiumCanvasAskKind } from '#constants/premium_report.constants'
import type { PremiumReportDocument } from '#contracts/premium_report'
import type { StaffHeatScale } from '#services/premium_report/premium_report_document'
import { collectArtifactCharts } from '#services/report_v4/artifact_html'
import type { ReportDesignPack } from '#services/report_v4/design/report_design_pack'
import { heatStaffTablesInDocument } from '#services/report_v4/orchestrator_helpers'
import type { ArtifactDesignOp } from '#services/report_v4/artifact_runtime/index'
import type { SoftEditOpsPlan } from '#services/report_v4/soft_edit_ops'
import type { ReportFact } from '#services/report_v4/report_facts'
import type { SoftRefusal } from '#services/report_v4/soft_refusal'
import type { AppLanguage } from '#utils/localize'
import {
  restoreDroppedChartsFromPrior,
  restoreSoftProseChartsFromPrior,
} from '#services/report_v4/soft_rebind_charts'
import { applySoftEditorialPhase } from '#services/report_v4/soft_rebind_editorial'
import { syncSoftRebindHtml } from '#services/report_v4/soft_rebind_html_sync'
import { finalizeAndHealSoftRebind } from '#services/report_v4/soft_rebind_validate'
import { resolveSoftRebindOutcome } from '#services/report_v4/soft_rebind_outcome'

type SoftRebindArgs = {
  priorHtml: string
  document: PremiumReportDocument
  priorDocument: PremiumReportDocument | null
  priorBlockIds: Set<string>
  priorChartCount: number
  softOps: SoftEditOpsPlan | null
  designOps?: ArtifactDesignOp[]
  softProseOnly: boolean
  softEditorialOnly: boolean
  softEditorialAppliedEarly: boolean
  recommendationStrip: boolean
  canvasAskKind: PremiumCanvasAskKind
  heatScales: StaffHeatScale[]
  designPack: ReportDesignPack
  language: AppLanguage
  clubName: string
  progress: (fr: string, en: string) => void
  facts?: Map<string, ReportFact>
}

type SoftRebindResult = {
  document: PremiumReportDocument
  htmlArtifact: string | null
  softRebindRepair: boolean
  needsFreshArtifact: boolean
  softApplied: string[]
  softBlocked: string[]
  coachMessage?: string
  restoredPrior?: boolean
  unsyncedBlockIds?: string[]
  refusals: SoftRefusal[]
}

export const runSoftRebind = (args: SoftRebindArgs): SoftRebindResult => {
  let document = args.document
  let chartCount = collectArtifactCharts(document, args.heatScales).length

  if (args.softProseOnly && args.priorDocument) {
    const restored = restoreSoftProseChartsFromPrior({
      document,
      priorDocument: args.priorDocument,
      heatScales: args.heatScales,
    })
    document = restored.document
    chartCount = restored.chartCount
  }

  const allowChartRestore =
    !args.softProseOnly &&
    !args.softEditorialOnly &&
    args.canvasAskKind !== PREMIUM_CANVAS_ASK.REMOVE &&
    args.priorDocument &&
    chartCount < args.priorChartCount
  if (allowChartRestore && args.priorDocument) {
    const restored = restoreDroppedChartsFromPrior({
      document,
      priorDocument: args.priorDocument,
      priorChartCount: args.priorChartCount,
      chartCount,
      heatScales: args.heatScales,
    })
    document = restored.document
    chartCount = restored.chartCount
  }

  document = heatStaffTablesInDocument(document, args.language, args.heatScales)

  const editorial = applySoftEditorialPhase({
    reboundHtml: args.priorHtml,
    document,
    softOps: args.softOps,
    softEditorialAppliedEarly: args.softEditorialAppliedEarly,
    language: args.language,
    clubName: args.clubName,
    heatScales: args.heatScales,
  })
  document = editorial.document

  const synced = syncSoftRebindHtml({
    reboundHtml: editorial.reboundHtml,
    document,
    priorDocument: args.priorDocument,
    priorBlockIds: args.priorBlockIds,
    softOps: args.softOps,
    designOps: args.designOps,
    allowChartRestore: Boolean(allowChartRestore),
    recommendationStrip: args.recommendationStrip,
    heatScales: args.heatScales,
    progress: args.progress,
  })

  const healed = finalizeAndHealSoftRebind({
    reboundHtml: synced.reboundHtml,
    document,
    priorDocument: args.priorDocument,
    heatScales: args.heatScales,
    designPack: args.designPack,
    language: args.language,
    tables: synced.tables,
    syncedTablesSynced: synced.syncedTables.synced,
    newChartBlocksLength: synced.newChartBlocks.length,
    facts: args.facts,
    syncedProseSynced: synced.syncedProse.synced,
    unsyncedBlockIds: synced.unsyncedBlockIds,
    recommendationStrip: args.recommendationStrip,
    recoStripped: synced.recoStripped,
    softEditorialOnly: args.softEditorialOnly,
    editorialGatesOk: editorial.editorialGatesOk,
    injectedHostShells: synced.injectedHostShells,
  })

  return resolveSoftRebindOutcome({
    document,
    priorHtml: args.priorHtml,
    priorDocument: args.priorDocument,
    priorChartCount: args.priorChartCount,
    softOps: args.softOps,
    designOps: args.designOps,
    softProseOnly: args.softProseOnly,
    softEditorialOnly: args.softEditorialOnly,
    recommendationStrip: args.recommendationStrip,
    language: args.language,
    editorialRemoved: editorial.editorialRemoved,
    tocAdded: editorial.tocAdded,
    emptyStripped: editorial.emptyStripped,
    syncedProseSynced: synced.syncedProse.synced,
    syncedTablesSynced: synced.syncedTables.synced,
    injectedHostShells: healed.injectedHostShells,
    softInject: synced.softInject,
    recoStripped: synced.recoStripped,
    sheetsRebuilt: synced.sheetsRebuilt,
    designApplied: synced.designApplied,
    newChartBlocksLength: synced.newChartBlocks.length,
    hostHealInjected: healed.hostHealInjected,
    editorialGatesOk: editorial.editorialGatesOk,
    rebound: healed.rebound,
    validation: healed.validation,
    chartCount: healed.chartCount,
  })
}
