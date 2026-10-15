import logger from '@adonisjs/core/services/logger'
import type { PremiumReportDocument } from '#contracts/premium_report'
import { evaluateArtifactParity } from '#services/report_v4/artifact_parity'
import {
  formatSoftEditPathMessage,
  refusalsFromSoftBlocked,
} from '#services/report_v4/soft_refusal'
import type { AppLanguage } from '#utils/localize'
import type { SoftEditOpsPlan } from '#services/report_v4/soft_edit_ops'
import type { SoftRebindGates } from '#services/report_v4/soft_rebind_outcome_gates'

type FinalizeOk = { ok: true; html: string; injectedCharts: number }
type FinalizeFail = { ok: false; error?: string }
type FinalizeResult = FinalizeOk | FinalizeFail

type ValidationResult = {
  missingHosts: string[]
  proseMiss: boolean
  unsyncedBlockIds: string[]
}

export type SoftRebindApplyResult = {
  document: PremiumReportDocument
  htmlArtifact: string | null
  softRebindRepair: boolean
  needsFreshArtifact: boolean
  coachMessage?: string
  restoredPrior: boolean
}

export const applySoftRebindBranches = (args: {
  document: PremiumReportDocument
  priorHtml: string
  priorDocument: PremiumReportDocument | null
  priorChartCount: number
  softOps: SoftEditOpsPlan | null
  language: AppLanguage
  editorialRemoved: number
  tocAdded: boolean
  emptyStripped: number
  syncedProseSynced: number
  syncedTablesSynced: number
  injectedHostShells: number
  recoStripped: number
  hostHealInjected: number
  editorialGatesOk: boolean
  rebound: FinalizeResult
  validation: ValidationResult
  chartCount: number
  recommendationStrip: boolean
  gates: SoftRebindGates
}): SoftRebindApplyResult => {
  const { gates } = args
  let document = args.document
  let htmlArtifact: string | null = null
  let softRebindRepair = false
  let needsFreshArtifact = true
  let coachMessage: string | undefined
  let restoredPrior = false

  if (gates.softOk && args.rebound.ok) {
    htmlArtifact = args.rebound.html
    softRebindRepair = false
    needsFreshArtifact = false
    const parity = evaluateArtifactParity(document, args.rebound.html)
    logger.info(
      {
        ok: parity.ok,
        issues: parity.issues.slice(0, 12),
        documentBlockCount: parity.documentBlockCount,
        htmlBlockCount: parity.htmlBlockCount,
      },
      'report_v4.artifact_parity'
    )
    logger.info(
      {
        htmlBytes: args.rebound.html.length,
        charts: args.chartCount,
        priorCharts: args.priorChartCount,
        injectedCharts: args.rebound.injectedCharts,
        injectedHostShells: args.injectedHostShells,
        hostHealInjected: args.hostHealInjected,
        syncedTables: args.syncedTablesSynced,
        syncedProse: args.syncedProseSynced,
        unsynced: args.validation.unsyncedBlockIds,
        recoStripped: args.recoStripped,
        editorialRemoved: args.editorialRemoved,
        tocAdded: args.tocAdded,
        emptyStripped: args.emptyStripped,
        applied: gates.mutationStats.applied,
        appliedCount: gates.mutationStats.appliedCount,
        mode: args.softOps?.hasDataOps ? 'soft_boot_inject' : 'soft_editorial_html',
      },
      'report_v4.designer_skipped_soft_rebind'
    )
    if (args.recoStripped > 0) {
      logger.info(
        { stripped: args.recoStripped, htmlBytes: args.rebound.html.length },
        'report_v4.soft_prose_recommendations_stripped'
      )
    }
  } else if (gates.zeroMutations && !gates.hardFail) {
    htmlArtifact = args.priorHtml
    if (args.priorDocument) document = args.priorDocument
    softRebindRepair = false
    needsFreshArtifact = false
    restoredPrior = true
    coachMessage = formatSoftEditPathMessage({
      path: 'unchanged',
      language: args.language,
    })
    logger.info(
      { blocked: gates.softBlocked, appliedCount: gates.mutationStats.appliedCount },
      'report_v4.soft_zero_mutations'
    )
  } else {
    htmlArtifact = args.priorHtml
    if (args.priorDocument) document = args.priorDocument
    softRebindRepair = false
    needsFreshArtifact = false
    restoredPrior = true
    const unsyncedLabel = args.validation.unsyncedBlockIds.slice(0, 5).join(', ')
    coachMessage = formatSoftEditPathMessage({
      path: 'local_refused',
      language: args.language,
      detail:
        args.language === 'fr'
          ? `Je n'ai pas pu appliquer la modification localement${unsyncedLabel ? ` (${unsyncedLabel})` : ''}. Le rapport précédent a été conservé. Voulez-vous que je refasse le rapport ?`
          : `I could not apply the change locally${unsyncedLabel ? ` (${unsyncedLabel})` : ''}. The previous report was kept. Should I rebuild the report?`,
    })
    logger.warn(
      {
        applied: gates.mutationStats.applied,
        appliedCount: gates.mutationStats.appliedCount,
        blocked: gates.softBlocked,
        unsynced: args.validation.unsyncedBlockIds,
        expectedSoftWork: gates.expectedSoftWork,
        hostHealInjected: args.hostHealInjected,
        restoredPrior: true,
        refusals: refusalsFromSoftBlocked({
          softBlocked: gates.softBlocked,
          unsyncedBlockIds: args.validation.unsyncedBlockIds,
          language: args.language,
        }),
      },
      'report_v4.soft_truth_escalate'
    )
    if (!args.rebound.ok && args.recommendationStrip) {
      logger.warn(
        { error: args.rebound.error, stripped: args.recoStripped },
        'report_v4.soft_prose_strip_finalize_failed'
      )
    }
  }

  return {
    document,
    htmlArtifact,
    softRebindRepair,
    needsFreshArtifact,
    coachMessage,
    restoredPrior,
  }
}

export const logSoftRebindValidate = (args: {
  validation: ValidationResult
  softRebindRepair: boolean
  rebound: FinalizeResult
  editorialGatesOk: boolean
  injectedHostShells: number
  hostHealInjected: number
  syncedProseSynced: number
  recoStripped: number
  tocAdded: boolean
  editorialRemoved: number
  gates: SoftRebindGates
  restoredPrior: boolean
}) => {
  logger.info(
    {
      missingHosts: args.validation.missingHosts,
      proseMiss: args.validation.proseMiss,
      unsynced: args.validation.unsyncedBlockIds,
      repaired: args.softRebindRepair,
      finalizeOk: args.rebound.ok,
      editorialGatesOk: args.editorialGatesOk,
      injectedHostShells: args.injectedHostShells,
      hostHealInjected: args.hostHealInjected,
      syncedProse: args.syncedProseSynced,
      recoStripped: args.recoStripped,
      tocAdded: args.tocAdded,
      editorialRemoved: args.editorialRemoved,
      applied: args.gates.mutationStats.applied,
      blocked: args.gates.softBlocked,
      restoredPrior: args.restoredPrior,
    },
    'report_v4.soft_rebind_validate'
  )
}
