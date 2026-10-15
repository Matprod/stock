import logger from '@adonisjs/core/services/logger'
import {
  collectArtifactCharts,
  collectArtifactTables,
  finalizeMinimalEmptyArtifact,
} from '#services/report_v4/artifact_html'
import type { ReportDesignPack } from '#services/report_v4/design/report_design_pack'
import type { ReportV4RunState } from '#services/report_v4/orchestrator_helpers'
import type { AppLanguage } from '#utils/localize'
import { renderDesignerTemplateArtifact } from '#services/report_v4/agents/designer_tools_template'

export type DesignerToolArgs = {
  run: ReportV4RunState
  clubName: string
  language: AppLanguage
  designPack: ReportDesignPack
  populatedDomains: string[]
  coachPrompt?: string
  title?: string
  individualSheetsAsk?: boolean
}

export const renderEmptyCoverageArtifact = (args: {
  clubName: string
  language: AppLanguage
  designPack: ReportDesignPack
  dateRange: { from: string; to: string }
  title?: string
  message?: string
}): string | null => {
  const finalized = finalizeMinimalEmptyArtifact({
    clubName: args.clubName,
    title: args.title,
    message:
      args.message?.trim() ||
      `For ${args.dateRange.from} → ${args.dateRange.to}, no usable data for this ask.`,
    dateRange: args.dateRange,
    pack: args.designPack,
    language: args.language,
  })
  return finalized.ok ? finalized.html : null
}

export const tryEmergencyDesignerArtifact = async (
  args: DesignerToolArgs,
  reason: string
): Promise<{ html: string; mode: 'template_fallback' | 'free_empty' } | null> => {
  const charts = collectArtifactCharts(args.run.agentState.document, args.run.agentState.heatScales)
  const tables = collectArtifactTables(args.run.agentState.document)
  const populated = args.populatedDomains.filter(Boolean)
  try {
    if (charts.length === 0 && tables.length === 0) {
      logger.warn(
        {
          reason: `${reason}_empty_coverage`,
          charts: 0,
          tables: 0,
          populatedDomains: populated.length,
        },
        'report_v4.designer_fallback_template'
      )
      const emptyHtml = renderEmptyCoverageArtifact({
        clubName: args.clubName,
        language: args.language,
        designPack: args.designPack,
        dateRange: args.run.agentState.document.dateRange,
        title: args.title,
      })
      return emptyHtml ? { html: emptyHtml, mode: 'free_empty' } : null
    }
    logger.warn(
      {
        reason,
        charts: charts.length,
        tables: tables.length,
        briefSignals: args.run.reportBrief?.signals.length ?? 0,
        populatedDomains: populated.length,
      },
      'report_v4.designer_fallback_template'
    )
    const html = await renderDesignerTemplateArtifact(args)
    return { html, mode: 'template_fallback' }
  } catch (error) {
    logger.error(
      { err: error, reason, charts: charts.length },
      'report_v4.designer_template_recover_failed'
    )
    return null
  }
}

export const commitEmergencyFallback = async (args: {
  toolArgs: DesignerToolArgs
  reason: string
  rejectPayload: Record<string, unknown>
  freeHtmlRejects: number
}): Promise<string> => {
  if (args.toolArgs.individualSheetsAsk && args.freeHtmlRejects < 3) {
    return JSON.stringify({
      ...args.rejectPayload,
      freeHtmlRejects: args.freeHtmlRejects,
      individualSheetsAsk: true,
      hint: 'Individual sheets ask — retry set_report_html with one chart-box group per athlete heading (no shared chart under a heading list). Server will not template-recover yet.',
    })
  }
  const emergency = await tryEmergencyDesignerArtifact(args.toolArgs, args.reason)
  if (emergency) {
    args.toolArgs.run.htmlArtifact = emergency.html
    args.toolArgs.run.agentState.mustUseTools = false
    args.toolArgs.run.templateRecoveredReason = args.reason
    logger.info(
      {
        reason: args.reason,
        mode: emergency.mode,
        htmlBytes: emergency.html.length,
        freeHtmlRejects: args.freeHtmlRejects,
      },
      'report_v4.designer_template_recovered'
    )
    return JSON.stringify({
      ok: true,
      mode: emergency.mode,
      autoFallback: true,
      bytes: emergency.html.length,
      charts: collectArtifactCharts(
        args.toolArgs.run.agentState.document,
        args.toolArgs.run.agentState.heatScales
      ).length,
      sections: args.toolArgs.run.reportBrief?.sections.length ?? 0,
      freeHtmlRejects: args.freeHtmlRejects,
      priorReject: args.rejectPayload,
      done: true,
    })
  }
  return JSON.stringify({
    ...args.rejectPayload,
    freeHtmlRejects: args.freeHtmlRejects,
    autoFallbackFailed: true,
    hint: 'Emergency template failed — retry set_report_html with a thinner document hosting every requiredChartIds id.',
  })
}
