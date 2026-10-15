import type { PremiumReportDocument } from '#contracts/premium_report'
import type { SoftEditOpsPlan } from '#services/report_v4/soft_edit_ops'
import { refusalsFromSoftBlocked, type SoftRefusal } from '#services/report_v4/soft_refusal'
import type { AppLanguage } from '#utils/localize'
import type { ArtifactDesignOp } from '#services/report_v4/artifact_runtime/index'
import { computeSoftRebindGates } from '#services/report_v4/soft_rebind_outcome_gates'
import {
  applySoftRebindBranches,
  logSoftRebindValidate,
} from '#services/report_v4/soft_rebind_outcome_apply'

type FinalizeOk = { ok: true; html: string; injectedCharts: number }
type FinalizeFail = { ok: false; error?: string }
type FinalizeResult = FinalizeOk | FinalizeFail

type ValidationResult = {
  missingHosts: string[]
  proseMiss: boolean
  unsyncedBlockIds: string[]
}

export const resolveSoftRebindOutcome = (args: {
  document: PremiumReportDocument
  priorHtml: string
  priorDocument: PremiumReportDocument | null
  priorChartCount: number
  softOps: SoftEditOpsPlan | null
  designOps?: ArtifactDesignOp[]
  softProseOnly: boolean
  softEditorialOnly: boolean
  recommendationStrip: boolean
  language: AppLanguage
  editorialRemoved: number
  tocAdded: boolean
  emptyStripped: number
  syncedProseSynced: number
  syncedTablesSynced: number
  injectedHostShells: number
  softInject: {
    injectedProse: number
    injectedSections: number
    injectedTables: number
  }
  recoStripped: number
  sheetsRebuilt: number
  designApplied: string[]
  newChartBlocksLength: number
  hostHealInjected: number
  editorialGatesOk: boolean
  rebound: FinalizeResult
  validation: ValidationResult
  chartCount: number
}): {
  document: PremiumReportDocument
  htmlArtifact: string | null
  softRebindRepair: boolean
  needsFreshArtifact: boolean
  softApplied: string[]
  softBlocked: string[]
  coachMessage?: string
  restoredPrior?: boolean
  unsyncedBlockIds: string[]
  refusals: SoftRefusal[]
} => {
  const gates = computeSoftRebindGates(args)
  const applied = applySoftRebindBranches({ ...args, gates })
  const refusals = refusalsFromSoftBlocked({
    softBlocked: gates.softBlocked,
    unsyncedBlockIds: args.validation.unsyncedBlockIds,
    language: args.language,
  })
  logSoftRebindValidate({
    validation: args.validation,
    softRebindRepair: applied.softRebindRepair,
    rebound: args.rebound,
    editorialGatesOk: args.editorialGatesOk,
    injectedHostShells: args.injectedHostShells,
    hostHealInjected: args.hostHealInjected,
    syncedProseSynced: args.syncedProseSynced,
    recoStripped: args.recoStripped,
    tocAdded: args.tocAdded,
    editorialRemoved: args.editorialRemoved,
    gates,
    restoredPrior: applied.restoredPrior,
  })

  return {
    document: applied.document,
    htmlArtifact: applied.htmlArtifact,
    softRebindRepair: applied.softRebindRepair,
    needsFreshArtifact: applied.needsFreshArtifact,
    softApplied: gates.mutationStats.applied,
    softBlocked: gates.softBlocked,
    coachMessage: applied.coachMessage,
    restoredPrior: applied.restoredPrior,
    unsyncedBlockIds: args.validation.unsyncedBlockIds,
    refusals,
  }
}
