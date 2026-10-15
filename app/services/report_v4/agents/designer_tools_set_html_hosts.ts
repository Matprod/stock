import logger from '@adonisjs/core/services/logger'
import {
  collectArtifactCharts,
  collectArtifactTables,
  countPresentChartHosts,
  finalizeArtifactHtml,
  freeArtifactTooThinForCharts,
  migrateOrdinalChartHostsInHtml,
  rebuildAthleteSheetsInArtifactHtml,
} from '#services/report_v4/artifact_html'
import {
  auditArtifactHtml,
  detectSoftDeltaGroundingScope,
  formatGroundingNudge,
} from '#services/report_v4/grounding_report'
import {
  findDuplicateChartHosts,
  findMissingChartHosts,
} from '#services/report_v4/chart_host_audit'
import type { DesignerToolArgs } from '#services/report_v4/agents/designer_tools_fallback'
import type { SetHtmlGroundingCtx } from '#services/report_v4/agents/designer_tools_set_html_grounding'
import { logLiteralFactWarnings } from '#services/report_v4/agents/designer_tools_set_html_grounding'

export type SetReportHtmlState = {
  freeHtmlRejects: number
  hostRepairNudged: boolean
}

export const finalizeSetReportHtml = async (args: {
  ctx: SetHtmlGroundingCtx
  toolArgs: DesignerToolArgs & { individualSheetsAsk?: boolean }
  state: SetReportHtmlState
  charts: ReturnType<typeof collectArtifactCharts>
  tables: ReturnType<typeof collectArtifactTables>
  bumpReject: () => void
  emergency: (reason: string, rejectPayload: Record<string, unknown>) => Promise<string>
}): Promise<string> => {
  const { toolArgs, state, charts, tables, bumpReject, emergency } = args
  const { groundingInput, groundingScope, requiredChartIds } = args.ctx

  const migrated = migrateOrdinalChartHostsInHtml(args.ctx.workingHtml, charts)
  const authoredHtml = migrated.html
  const presentBefore = countPresentChartHosts(authoredHtml, charts)
  const missingBefore = Math.max(0, charts.length - presentBefore)
  const missingHostIds = findMissingChartHosts(authoredHtml, requiredChartIds)
  const duplicateHostIds = findDuplicateChartHosts(authoredHtml)

  if (missingBefore > 0 && charts.length > 0 && !state.hostRepairNudged) {
    state.hostRepairNudged = true
    bumpReject()
    if (state.freeHtmlRejects < 2) {
      return JSON.stringify({
        error: 'html missing chart hosts — repair required',
        requiredChartIds,
        presentHosts: presentBefore,
        missingHosts: missingBefore,
        missingChartIds: missingHostIds,
        duplicateChartIds: duplicateHostIds,
        freeHtmlRejects: state.freeHtmlRejects,
        hint: 'Host every requiredChartIds id as <div class="chart-box" id="{exact id}">, then retry set_report_html.',
      })
    }
    return await emergency('set_report_html_missing_hosts', {
      error: 'html missing chart hosts after retry',
      requiredChartIds,
      presentHosts: presentBefore,
      missingHosts: missingBefore,
      missingChartIds: missingHostIds,
      duplicateChartIds: duplicateHostIds,
    })
  }

  if (
    missingBefore > 0 &&
    freeArtifactTooThinForCharts({
      chartCount: charts.length,
      injectedCharts: missingBefore,
      presentHosts: presentBefore,
    })
  ) {
    bumpReject()
    return await emergency('set_report_html_thin_hosts', {
      error: 'html too thin: most chart hosts missing from authored layout',
      charts: charts.length,
      presentHosts: presentBefore,
      missingHosts: missingBefore,
      requiredChartIds,
    })
  }

  const allowInject = missingBefore > 0 && state.hostRepairNudged
  const finalized = finalizeArtifactHtml({
    html: authoredHtml,
    charts,
    pack: toolArgs.designPack,
    coachPrompt: toolArgs.coachPrompt,
    language: toolArgs.language,
    tables,
    injectMissingHosts: allowInject,
    facts: toolArgs.run.facts,
    datasets: toolArgs.run.agentState.datasets.values(),
    linkDisplayedNumbers: true,
    document: toolArgs.run.document,
    blockOrigin: 'generate',
  })
  if (!finalized.ok) {
    bumpReject()
    return await emergency('set_report_html_finalize_reject', {
      error: finalized.error,
      warnings: finalized.warnings,
      requiredChartIds: charts.map((c) => c.id),
    })
  }
  if (
    freeArtifactTooThinForCharts({
      chartCount: charts.length,
      injectedCharts: finalized.injectedCharts,
      presentHosts: finalized.presentHosts,
    })
  ) {
    bumpReject()
    return await emergency('set_report_html_thin_finalized', {
      error: 'html too thin: most chart hosts missing from authored layout',
      warnings: finalized.warnings,
      charts: charts.length,
      presentHosts: finalized.presentHosts,
      injectedCharts: finalized.injectedCharts,
      requiredChartIds: charts.map((c) => c.id),
    })
  }
  const finalizedGrounding = auditArtifactHtml(
    finalized.html,
    groundingInput,
    detectSoftDeltaGroundingScope(finalized.html) ?? groundingScope
  )
  logLiteralFactWarnings(finalizedGrounding)
  if (!finalizedGrounding.ok) {
    bumpReject()
    logger.warn(
      {
        codes: finalizedGrounding.violations.map((v) => v.code),
        violations: finalizedGrounding.violations.slice(0, 12),
      },
      'report_v4.grounding_reject'
    )
    return await emergency('set_report_html_finalized_grounding', {
      error: 'Finalized HTML failed grounding audit',
      nudge: formatGroundingNudge(finalizedGrounding),
      violations: finalizedGrounding.violations.slice(0, 8),
      warnings: finalizedGrounding.warnings?.slice(0, 8),
    })
  }
  let htmlOut = finalized.html
  let sheetsRebuilt = 0
  if (toolArgs.individualSheetsAsk) {
    const athleteNames = toolArgs.run.document.blocks
      .filter((block) => block.type === 'heading')
      .map((block) => ('text' in block ? block.text : ''))
      .filter(Boolean)
    const rebuilt = rebuildAthleteSheetsInArtifactHtml(htmlOut, toolArgs.run.document, {
      athleteNames,
    })
    if (rebuilt.sections >= 2) {
      htmlOut = rebuilt.html
      sheetsRebuilt = rebuilt.sections
      logger.info(
        { sections: rebuilt.sections, mismatches: rebuilt.mismatches },
        'report_v4.athlete_sheets_rebuilt_generate'
      )
    }
  }
  toolArgs.run.htmlArtifact = htmlOut
  toolArgs.run.agentState.mustUseTools = false
  return JSON.stringify({
    ok: true,
    mode: 'free',
    bytes: htmlOut.length,
    charts: charts.length,
    presentHosts: finalized.presentHosts,
    injectedCharts: finalized.injectedCharts,
    sheetsRebuilt,
    warnings: finalized.warnings,
    done: true,
  })
}
