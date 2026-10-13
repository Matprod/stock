import logger from '@adonisjs/core/services/logger'
import { PREMIUM_CANVAS_ASK, type PremiumCanvasAskKind } from '#constants/premium_report.constants'
import type { PremiumReportDocument } from '#contracts/premium_report'
import type { StaffHeatScale } from '#services/premium_report/premium_report_document'
import {
  collectArtifactCharts,
  collectArtifactTables,
  finalizeArtifactHtml,
  injectMissingChartHostShells,
  injectNewSoftBlocksIntoArtifactHtml,
  rebuildAthleteSheetsInArtifactHtml,
  stripRecommendationSectionsFromHtml,
  syncProseIntoArtifactHtml,
  syncTablesIntoArtifactHtml,
  validateSoftRebindHtml,
} from '#services/report_v4/artifact_html'
import { evaluateArtifactParity } from '#services/report_v4/artifact_parity'
import {
  healMissingChartHosts,
  shouldAttemptHostHeal,
} from '#services/report_v4/artifact_delta_repair'
import type { ReportDesignPack } from '#services/report_v4/design/report_design_pack'
import { heatStaffTablesInDocument } from '#services/report_v4/orchestrator_helpers'
import {
  applyDesignOpsToHtml,
  countSoftMutations,
} from '#services/report_v4/artifact_runtime/index'
import type { ArtifactDesignOp } from '#services/report_v4/artifact_runtime/index'
import { applyResolvedSoftEditorial, type SoftEditOpsPlan } from '#services/report_v4/soft_edit_ops'
import type { ReportFact } from '#services/report_v4/report_facts'
import {
  formatSoftEditPathMessage,
  refusalsFromSoftBlocked,
  type SoftRefusal,
} from '#services/report_v4/soft_refusal'
import type { AppLanguage } from '#utils/localize'

export type SoftRebindArgs = {
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

export type SoftRebindResult = {
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
  let charts = collectArtifactCharts(document, args.heatScales)
  let chartCount = charts.length
  let softRebindRepair = false
  let needsFreshArtifact = true
  let htmlArtifact: string | null = null

  if (args.softProseOnly && args.priorDocument) {
    const priorCharts = new Map(
      args.priorDocument.blocks
        .filter((block) => block.type === 'chart')
        .map((block) => [block.id, block])
    )
    document.blocks = document.blocks.map((block) => {
      if (block.type !== 'chart') return block
      return priorCharts.get(block.id) ?? block
    })
    charts = collectArtifactCharts(document, args.heatScales)
    chartCount = charts.length
    logger.info({ charts: chartCount }, 'report_v4.soft_prose_charts_restored_from_prior')
  }

  const allowChartRestore =
    !args.softProseOnly &&
    !args.softEditorialOnly &&
    args.canvasAskKind !== PREMIUM_CANVAS_ASK.REMOVE &&
    args.priorDocument &&
    chartCount < args.priorChartCount
  if (allowChartRestore && args.priorDocument) {
    logger.warn(
      { charts: chartCount, priorCharts: args.priorChartCount },
      'report_v4.soft_rebind_chart_drop_restored'
    )
    const currentIds = new Set(
      document.blocks.filter((b) => b.type === 'chart').map((b) => b.id)
    )
    const missing = args.priorDocument.blocks
      .map((block, index) => ({ block, index }))
      .filter(({ block }) => block.type === 'chart' && !currentIds.has(block.id))
    for (const row of missing) {
      let insertAt = document.blocks.length
      for (let i = row.index - 1; i >= 0; i -= 1) {
        const prevId = args.priorDocument.blocks[i]?.id
        if (!prevId) continue
        const curIdx = document.blocks.findIndex((b) => b.id === prevId)
        if (curIdx >= 0) {
          insertAt = curIdx + 1
          break
        }
        if (i === 0) insertAt = 0
      }
      if (row.index === 0) insertAt = 0
      document.blocks.splice(insertAt, 0, row.block)
    }
    charts = collectArtifactCharts(document, args.heatScales)
    chartCount = charts.length
  }

  document = heatStaffTablesInDocument(document, args.language, args.heatScales)

  let reboundHtml = args.priorHtml
  let editorialRemoved = 0
  let tocAdded = false
  let emptyStripped = 0
  let editorialGatesOk = true

  if (
    args.softOps &&
    ((args.softOps.removeQueries.length > 0 && !args.softEditorialAppliedEarly) ||
      args.softOps.ensureToc ||
      args.softOps.ops.some((op) => op.type === 'strip_empty_sections'))
  ) {
    const lateOps = args.softEditorialAppliedEarly
      ? {
          ...args.softOps,
          removeQueries: [] as string[],
          ops: args.softOps.ops.filter((op) => op.type !== 'remove_section'),
        }
      : args.softOps
    const editorial = applyResolvedSoftEditorial({
      html: reboundHtml,
      document,
      ops: lateOps,
      language: args.language,
      clubName: args.clubName,
      reportTitle: document.title,
    })
    reboundHtml = editorial.html
    document = editorial.document
    editorialRemoved = editorial.removed.length
    tocAdded = editorial.tocAdded
    emptyStripped = editorial.emptyStripped
    editorialGatesOk = editorial.gates.ok
    charts = collectArtifactCharts(document, args.heatScales)
    chartCount = charts.length
    logger.info(
      {
        removedSections: editorialRemoved,
        tocAdded,
        emptyStripped,
        droppedBlockIds: editorial.droppedBlockIds,
        gates: editorial.gates,
        earlyRemove: args.softEditorialAppliedEarly,
      },
      'report_v4.soft_editorial_applied'
    )
    if (!editorial.gates.ok) {
      logger.warn({ errors: editorial.gates.errors }, 'report_v4.soft_editorial_gates_failed')
    }
  } else if (args.softEditorialAppliedEarly) {
    editorialGatesOk = true
  }

  let designApplied: string[] = []
  if (args.designOps?.length) {
    const design = applyDesignOpsToHtml(reboundHtml, args.designOps)
    reboundHtml = design.html
    designApplied = design.applied
    if (design.applied.length) {
      logger.info({ applied: design.applied }, 'report_v4.soft_design_ops_applied')
    }
  }

  const syncedProse = syncProseIntoArtifactHtml(reboundHtml, document, args.priorDocument)
  reboundHtml = syncedProse.html
  const unsyncedBlockIds = [...syncedProse.unsynced]

  let sheetsRebuilt = 0
  if (args.softOps?.layoutRepair || args.softOps?.restoreSheets) {
    const paired = rebuildAthleteSheetsInArtifactHtml(reboundHtml, document)
    reboundHtml = paired.html
    sheetsRebuilt = paired.sections
    if (paired.sections > 0) {
      logger.info({ sections: paired.sections }, 'report_v4.soft_athlete_sheets_rebuilt')
    }
  }
  const softInject = injectNewSoftBlocksIntoArtifactHtml(
    reboundHtml,
    document,
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

  const tables = collectArtifactTables(document)
  const syncedTables = syncTablesIntoArtifactHtml(reboundHtml, tables)
  reboundHtml = syncedTables.html
  for (const id of syncedTables.unsynced) {
    if (!unsyncedBlockIds.includes(id)) unsyncedBlockIds.push(id)
  }

  const newChartBlocks = document.blocks.filter(
    (b) => b.type === 'chart' && !args.priorBlockIds.has(b.id)
  )
  let injectedHostShells = 0
  if (newChartBlocks.length > 0 || allowChartRestore) {
    charts = collectArtifactCharts(document, args.heatScales)
    chartCount = charts.length
    const injectedHosts = injectMissingChartHostShells(reboundHtml, charts, {
      document,
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

  charts = collectArtifactCharts(document, args.heatScales)
  chartCount = charts.length
  let rebound = finalizeArtifactHtml({
    html: reboundHtml,
    charts,
    pack: args.designPack,
    language: args.language,
    tables: syncedTables.synced >= tables.length ? undefined : tables,
    injectMissingHosts: newChartBlocks.length > 0,
    facts: args.facts,
    document,
    blockOrigin: 'soft_edit',
  })
  let htmlForValidate = rebound.ok ? rebound.html : reboundHtml
  let validation = validateSoftRebindHtml({
    html: htmlForValidate,
    charts,
    document,
    priorDocument: args.priorDocument,
    syncedProse: syncedProse.synced,
    unsyncedBlockIds,
  })
  if (args.recommendationStrip && recoStripped > 0 && validation.proseMiss) {
    validation = {
      ...validation,
      proseMiss: false,
      unsyncedBlockIds: [],
      ok: validation.missingHosts.length === 0,
    }
  }
  if (args.softEditorialOnly && editorialGatesOk) {
    validation = {
      ...validation,
      proseMiss: false,
      unsyncedBlockIds: [],
      ok: validation.missingHosts.length === 0 && editorialGatesOk,
    }
  }

  let hostHealInjected = 0
  if (
    shouldAttemptHostHeal({
      missingHosts: validation.missingHosts,
      proseMiss: validation.proseMiss,
      editorialGatesOk,
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
        tables: syncedTables.synced >= tables.length ? undefined : tables,
        injectMissingHosts: true,
        facts: args.facts,
        document,
        blockOrigin: 'soft_edit',
      })
      htmlForValidate = rebound.ok ? rebound.html : reboundHtml
      validation = validateSoftRebindHtml({
        html: htmlForValidate,
        charts,
        document,
        priorDocument: args.priorDocument,
        syncedProse: syncedProse.synced,
        unsyncedBlockIds: validation.unsyncedBlockIds,
      })
      if (args.softEditorialOnly && editorialGatesOk) {
        validation = {
          ...validation,
          proseMiss: false,
          unsyncedBlockIds: [],
          ok: validation.missingHosts.length === 0 && editorialGatesOk,
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

  const chartOptionsPatched = Number(args.softOps?.chartOptionsPatched ?? 0)
  const mutationStats = countSoftMutations({
    editorialRemoved,
    tocAdded,
    emptyStripped,
    syncedProse: syncedProse.synced,
    syncedTables: syncedTables.synced,
    injectedHostShells,
    injectedProse: softInject.injectedProse,
    injectedSections: softInject.injectedSections,
    injectedTables: softInject.injectedTables,
    injectedCharts: rebound.ok ? rebound.injectedCharts : 0,
    recoStripped,
    sheetsRebuilt,
    chartOptionsPatched,
    designApplied,
  })
  const expectedSoftWork = Boolean(
    args.softOps ||
      args.designOps?.length ||
      args.softProseOnly ||
      args.softEditorialOnly ||
      args.recommendationStrip ||
      newChartBlocks.length > 0 ||
      hostHealInjected > 0
  )
  const softBlocked: string[] = []
  if (!editorialGatesOk) softBlocked.push('editorial_gates')
  if (!rebound.ok) softBlocked.push('finalize_html')
  if (validation.missingHosts.length) softBlocked.push('missing_hosts')
  if (validation.unsyncedBlockIds.length) {
    softBlocked.push('prose_miss')
    for (const id of validation.unsyncedBlockIds) softBlocked.push(`unsynced:${id}`)
  }
  const zeroMutations = expectedSoftWork && mutationStats.appliedCount === 0
  if (zeroMutations) softBlocked.push('zero_mutations')

  const hardFail =
    !editorialGatesOk ||
    !rebound.ok ||
    validation.missingHosts.length > 0 ||
    validation.unsyncedBlockIds.length > 0
  const softOk = !hardFail && !zeroMutations
  let coachMessage: string | undefined
  let restoredPrior = false

  if (softOk && rebound.ok) {
    htmlArtifact = rebound.html
    softRebindRepair = false
    needsFreshArtifact = false
    const parity = evaluateArtifactParity(document, rebound.html)
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
        htmlBytes: rebound.html.length,
        charts: chartCount,
        priorCharts: args.priorChartCount,
        injectedCharts: rebound.injectedCharts,
        injectedHostShells,
        hostHealInjected,
        syncedTables: syncedTables.synced,
        syncedProse: syncedProse.synced,
        unsynced: validation.unsyncedBlockIds,
        recoStripped,
        editorialRemoved,
        tocAdded,
        emptyStripped,
        applied: mutationStats.applied,
        appliedCount: mutationStats.appliedCount,
        mode: args.softOps?.hasDataOps ? 'soft_boot_inject' : 'soft_editorial_html',
      },
      'report_v4.designer_skipped_soft_rebind'
    )
    if (recoStripped > 0) {
      logger.info(
        { stripped: recoStripped, htmlBytes: rebound.html.length },
        'report_v4.soft_prose_recommendations_stripped'
      )
    }
  } else if (zeroMutations && !hardFail) {
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
      { blocked: softBlocked, appliedCount: mutationStats.appliedCount },
      'report_v4.soft_zero_mutations'
    )
  } else {
    htmlArtifact = args.priorHtml
    if (args.priorDocument) document = args.priorDocument
    softRebindRepair = false
    needsFreshArtifact = false
    restoredPrior = true
    const unsyncedLabel = validation.unsyncedBlockIds.slice(0, 5).join(', ')
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
        applied: mutationStats.applied,
        appliedCount: mutationStats.appliedCount,
        blocked: softBlocked,
        unsynced: validation.unsyncedBlockIds,
        expectedSoftWork,
        hostHealInjected,
        restoredPrior: true,
        refusals: refusalsFromSoftBlocked({
          softBlocked,
          unsyncedBlockIds: validation.unsyncedBlockIds,
          language: args.language,
        }),
      },
      'report_v4.soft_truth_escalate'
    )
    if (!rebound.ok && args.recommendationStrip) {
      logger.warn(
        { error: rebound.error, stripped: recoStripped },
        'report_v4.soft_prose_strip_finalize_failed'
      )
    }
  }

  const refusals = refusalsFromSoftBlocked({
    softBlocked,
    unsyncedBlockIds: validation.unsyncedBlockIds,
    language: args.language,
  })
  logger.info(
    {
      missingHosts: validation.missingHosts,
      proseMiss: validation.proseMiss,
      unsynced: validation.unsyncedBlockIds,
      repaired: softRebindRepair,
      finalizeOk: rebound.ok,
      editorialGatesOk,
      injectedHostShells,
      hostHealInjected,
      syncedProse: syncedProse.synced,
      recoStripped,
      tocAdded,
      editorialRemoved,
      applied: mutationStats.applied,
      blocked: softBlocked,
      restoredPrior,
    },
    'report_v4.soft_rebind_validate'
  )

  return {
    document,
    htmlArtifact,
    softRebindRepair,
    needsFreshArtifact,
    softApplied: mutationStats.applied,
    softBlocked,
    coachMessage,
    restoredPrior,
    unsyncedBlockIds: validation.unsyncedBlockIds,
    refusals,
  }
}
