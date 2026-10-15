import logger from '@adonisjs/core/services/logger'
import type { PremiumReportDocument } from '#contracts/premium_report'
import type { StaffHeatScale } from '#services/premium_report/premium_report_document'
import {
  collectArtifactCharts,
  collectArtifactTables,
  finalizeArtifactHtml,
  validateSoftRebindHtml,
} from '#services/report_v4/artifact_html'
import {
  healMissingChartHosts,
  shouldAttemptHostHeal,
} from '#services/report_v4/artifact_delta_repair'
import type { ReportDesignPack } from '#services/report_v4/design/report_design_pack'
import type { ReportFact } from '#services/report_v4/report_facts'
import type { AppLanguage } from '#utils/localize'

type FinalizeResult = ReturnType<typeof finalizeArtifactHtml>
type ValidationResult = ReturnType<typeof validateSoftRebindHtml>

export const finalizeAndHealSoftRebind = (args: {
  reboundHtml: string
  document: PremiumReportDocument
  priorDocument: PremiumReportDocument | null
  heatScales: StaffHeatScale[]
  designPack: ReportDesignPack
  language: AppLanguage
  tables: ReturnType<typeof collectArtifactTables>
  syncedTablesSynced: number
  newChartBlocksLength: number
  facts?: Map<string, ReportFact>
  syncedProseSynced: number
  unsyncedBlockIds: string[]
  recommendationStrip: boolean
  recoStripped: number
  softEditorialOnly: boolean
  editorialGatesOk: boolean
  injectedHostShells: number
}): {
  reboundHtml: string
  rebound: FinalizeResult
  validation: ValidationResult
  chartCount: number
  injectedHostShells: number
  hostHealInjected: number
} => {
  let reboundHtml = args.reboundHtml
  let injectedHostShells = args.injectedHostShells
  const charts = collectArtifactCharts(args.document, args.heatScales)
  const chartCount = charts.length
  const tablesOpt = args.syncedTablesSynced >= args.tables.length ? undefined : args.tables

  let rebound = finalizeArtifactHtml({
    html: reboundHtml,
    charts,
    pack: args.designPack,
    language: args.language,
    tables: tablesOpt,
    injectMissingHosts: args.newChartBlocksLength > 0,
    facts: args.facts,
    linkDisplayedNumbers: false,
    document: args.document,
    blockOrigin: 'soft_edit',
  })
  let htmlForValidate = rebound.ok ? rebound.html : reboundHtml
  let validation = validateSoftRebindHtml({
    html: htmlForValidate,
    charts,
    document: args.document,
    priorDocument: args.priorDocument,
    syncedProse: args.syncedProseSynced,
    unsyncedBlockIds: args.unsyncedBlockIds,
  })
  if (args.recommendationStrip && args.recoStripped > 0 && validation.proseMiss) {
    validation = {
      ...validation,
      proseMiss: false,
      unsyncedBlockIds: [],
      ok: validation.missingHosts.length === 0,
    }
  }
  if (args.softEditorialOnly && args.editorialGatesOk) {
    validation = {
      ...validation,
      proseMiss: false,
      unsyncedBlockIds: [],
      ok: validation.missingHosts.length === 0 && args.editorialGatesOk,
    }
  }

  let hostHealInjected = 0
  if (
    shouldAttemptHostHeal({
      missingHosts: validation.missingHosts,
      proseMiss: validation.proseMiss,
      editorialGatesOk: args.editorialGatesOk,
    })
  ) {
    const heal = healMissingChartHosts({ html: reboundHtml, charts })
    if (heal.healed || (heal.injected > 0 && heal.missingAfter.length === 0)) {
      hostHealInjected = heal.injected
      injectedHostShells += heal.injected
      reboundHtml = heal.html
      rebound = finalizeArtifactHtml({
        html: reboundHtml,
        charts,
        pack: args.designPack,
        language: args.language,
        tables: tablesOpt,
        injectMissingHosts: true,
        facts: args.facts,
        linkDisplayedNumbers: false,
        document: args.document,
        blockOrigin: 'soft_edit',
      })
      htmlForValidate = rebound.ok ? rebound.html : reboundHtml
      validation = validateSoftRebindHtml({
        html: htmlForValidate,
        charts,
        document: args.document,
        priorDocument: args.priorDocument,
        syncedProse: args.syncedProseSynced,
        unsyncedBlockIds: validation.unsyncedBlockIds,
      })
      if (args.softEditorialOnly && args.editorialGatesOk) {
        validation = {
          ...validation,
          proseMiss: false,
          unsyncedBlockIds: [],
          ok: validation.missingHosts.length === 0 && args.editorialGatesOk,
        }
      }
      logger.info(
        {
          injected: heal.injected,
          missingBefore: heal.missingBefore,
          missingAfter: heal.missingAfter,
          finalizeOk: rebound.ok,
        },
        'report_v4.host_heal_delta'
      )
    } else if (heal.tooThin) {
      logger.warn(
        { missingBefore: heal.missingBefore, charts: chartCount },
        'report_v4.host_heal_too_thin'
      )
    }
  }

  return {
    reboundHtml,
    rebound,
    validation,
    chartCount,
    injectedHostShells,
    hostHealInjected,
  }
}
