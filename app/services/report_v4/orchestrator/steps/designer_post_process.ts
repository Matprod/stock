import * as m from '#services/report_v4/orchestrator/main_pipeline_bindings'
import type { PipelineState } from '#services/report_v4/orchestrator/pipeline_state'
import { recoverTemplateArtifact } from '#services/report_v4/orchestrator/steps/designer_template_recovery'
import { freeDesignerHtmlLooksValid } from '#services/report_v4/free_designer/assemble_document'
import { isReportV4FreeDesignerEnabled } from '#services/report_v4/free_designer/flag'
import { runFreeDesignerPostWriteControls } from '#services/report_v4/free_designer/post_write_controls'

export const runDesignerPostProcess = async (state: PipelineState): Promise<void> => {
  const { run, heatScales, ctx } = state
  const { args, deps: d, framed, plan: planRaw } = ctx
  const { club, multiSectionAsk, preserveCanvas, displayRange } = framed
  const { designPack, domains } = planRaw
  const needsFreshArtifact = state.needsFreshArtifact

  if (needsFreshArtifact && !m.artifactHtmlLooksValid(run.htmlArtifact)) {
    const chartsLeft = m.collectArtifactCharts(run.document, heatScales).length
    const tablesLeft = m.collectArtifactTables(run.document).length
    const briefSignals = run.reportBrief?.signals.length ?? 0
    if (chartsLeft > 0 || tablesLeft > 0) {
      m.logger.warn(
        {
          reason: 'orchestrator_post_designer_fallback',
          charts: chartsLeft,
          tables: tablesLeft,
          domains,
          briefSignals,
          multiSectionAsk,
          preserveCanvas,
        },
        'report_v4.designer_fallback_template'
      )
      await recoverTemplateArtifact('orchestrator_post_designer_fallback', state)
    }
    if (!m.artifactHtmlLooksValid(run.htmlArtifact)) {
      if (
        chartsLeft > 0 ||
        tablesLeft > 0 ||
        briefSignals > 0 ||
        domains.length >= 2 ||
        multiSectionAsk
      ) {
        m.logger.error(
          {
            reason: 'designer_failed_no_usable_artifact',
            charts: chartsLeft,
            tables: tablesLeft,
            domains,
            briefSignals,
            multiSectionAsk,
            preserveCanvas,
          },
          'report_v4.designer_abort_ungrounded'
        )
        throw new m.Exception('Designer failed grounding / free artifact — refusing empty PDF', {
          status: 422,
        })
      }
      const emptyMessage = `For ${displayRange.from} → ${displayRange.to}, no usable data for this ask.`
      m.logger.warn(
        {
          reason: 'emergency_after_designer_empty',
          charts: chartsLeft,
          tables: tablesLeft,
          briefSignals,
          domains,
        },
        'report_v4.designer_fallback_template'
      )
      const emptyArtifact = d.finalizeMinimalEmptyArtifact({
        clubName: club.name,
        title: run.document.title || (args.language === 'fr' ? 'Rapport staff' : 'Staff report'),
        message: emptyMessage,
        dateRange: displayRange,
        pack: designPack,
        language: args.language,
      })
      if (!emptyArtifact.ok) {
        throw new m.Exception(
          `Designer failed and empty artifact finalize failed: ${emptyArtifact.error}`,
          { status: 422 }
        )
      }
      run.htmlArtifact = emptyArtifact.html
    }
  }

  if (
    needsFreshArtifact &&
    isReportV4FreeDesignerEnabled() &&
    freeDesignerHtmlLooksValid(run.htmlArtifact) &&
    !state.softRebindRepair
  ) {
    await runFreeDesignerPostWriteControls({
      run,
      language: args.language,
      clubName: club.name,
    })
  }
}
