import logger from '@adonisjs/core/services/logger'
import type { PremiumReportDocument } from '#contracts/premium_report'
import type { StaffHeatScale } from '#services/premium_report/premium_report_document'
import {
  collectArtifactCharts,
  collectArtifactTables,
  injectMissingChartHostShells,
  injectNewSoftBlocksIntoArtifactHtml,
  rebuildAthleteSheetsInArtifactHtml,
  stripRecommendationSectionsFromHtml,
  syncProseIntoArtifactHtml,
  syncTablesIntoArtifactHtml,
} from '#services/report_v4/artifact_html'
import {
  applyDesignOpsToHtml,
  type ArtifactDesignOp,
} from '#services/report_v4/artifact_runtime/index'
import type { SoftEditOpsPlan } from '#services/report_v4/soft_edit_ops'

export const syncSoftRebindHtml = (args: {
  reboundHtml: string
  document: PremiumReportDocument
  priorDocument: PremiumReportDocument | null
  priorBlockIds: Set<string>
  softOps: SoftEditOpsPlan | null
  designOps?: ArtifactDesignOp[]
  allowChartRestore: boolean
  recommendationStrip: boolean
  heatScales: StaffHeatScale[]
  progress: (fr: string, en: string) => void
}): {
  reboundHtml: string
  designApplied: string[]
  syncedProse: { synced: number; unsynced: string[] }
  unsyncedBlockIds: string[]
  sheetsRebuilt: number
  softInject: {
    injectedProse: number
    injectedSections: number
    injectedTables: number
  }
  tables: ReturnType<typeof collectArtifactTables>
  syncedTables: { html: string; synced: number; unsynced: string[] }
  newChartBlocks: PremiumReportDocument['blocks']
  injectedHostShells: number
  recoStripped: number
  chartCount: number
} => {
  let reboundHtml = args.reboundHtml
  let designApplied: string[] = []
  if (args.designOps?.length) {
    const design = applyDesignOpsToHtml(reboundHtml, args.designOps)
    reboundHtml = design.html
    designApplied = design.applied
    if (design.applied.length) {
      logger.info({ applied: design.applied }, 'report_v4.soft_design_ops_applied')
    }
  }

  const syncedProse = syncProseIntoArtifactHtml(reboundHtml, args.document, args.priorDocument)
  reboundHtml = syncedProse.html
  const unsyncedBlockIds = [...syncedProse.unsynced]

  let sheetsRebuilt = 0
  if (args.softOps?.layoutRepair || args.softOps?.restoreSheets) {
    const athleteNames = args.document.blocks
      .filter((block) => block.type === 'heading')
      .map((block) => ('text' in block ? block.text : ''))
      .filter(Boolean)
    const paired = rebuildAthleteSheetsInArtifactHtml(reboundHtml, args.document, {
      athleteNames,
    })
    reboundHtml = paired.html
    sheetsRebuilt = paired.sections
    if (paired.sections > 0) {
      logger.info({ sections: paired.sections }, 'report_v4.soft_athlete_sheets_rebuilt')
    }
  }
  const softInject = injectNewSoftBlocksIntoArtifactHtml(
    reboundHtml,
    args.document,
    args.priorBlockIds,
    {
      underEachChart: Boolean(args.softOps?.addSectionProse),
    }
  )
  reboundHtml = softInject.html
  if (
    softInject.injectedProse > 0 ||
    softInject.injectedSections > 0 ||
    softInject.injectedTables > 0
  ) {
    logger.info(
      {
        injectedProse: softInject.injectedProse,
        injectedSections: softInject.injectedSections,
        injectedTables: softInject.injectedTables,
      },
      'report_v4.soft_new_blocks_injected'
    )
  }

  const tables = collectArtifactTables(args.document)
  const syncedTables = syncTablesIntoArtifactHtml(reboundHtml, tables)
  reboundHtml = syncedTables.html
  for (const id of syncedTables.unsynced) {
    if (!unsyncedBlockIds.includes(id)) unsyncedBlockIds.push(id)
  }

  const newChartBlocks = args.document.blocks.filter(
    (b) => b.type === 'chart' && !args.priorBlockIds.has(b.id)
  )
  let injectedHostShells = 0
  let chartCount = collectArtifactCharts(args.document, args.heatScales).length
  if (newChartBlocks.length > 0 || args.allowChartRestore) {
    const charts = collectArtifactCharts(args.document, args.heatScales)
    chartCount = charts.length
    const injectedHosts = injectMissingChartHostShells(reboundHtml, charts, {
      document: args.document,
      priorDocument: args.priorDocument,
    })
    reboundHtml = injectedHosts.html
    injectedHostShells = injectedHosts.injected
    if (injectedHostShells > 0) {
      logger.info({ injected: injectedHostShells }, 'report_v4.soft_boot_hosts_injected')
    }
  }

  let recoStripped = 0
  if (args.recommendationStrip) {
    args.progress('Mise à jour du texte...', 'Updating the prose...')
    const stripped = stripRecommendationSectionsFromHtml(reboundHtml)
    reboundHtml = stripped.html
    recoStripped = stripped.stripped
  }

  return {
    reboundHtml,
    designApplied,
    syncedProse,
    unsyncedBlockIds,
    sheetsRebuilt,
    softInject: {
      injectedProse: softInject.injectedProse,
      injectedSections: softInject.injectedSections,
      injectedTables: softInject.injectedTables,
    },
    tables,
    syncedTables,
    newChartBlocks,
    injectedHostShells,
    recoStripped,
    chartCount,
  }
}
