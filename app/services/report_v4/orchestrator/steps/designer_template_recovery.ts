import * as m from '#services/report_v4/orchestrator/main_pipeline_bindings'
import type { PipelineState } from '#services/report_v4/orchestrator/pipeline_state'

export const recoverTemplateArtifact = async (
  reason: string,
  state: PipelineState
): Promise<boolean> => {
  const { run, ctx } = state
  const { args, framed, plan: planRaw } = ctx
  const { club } = framed
  const { designPack, domains } = planRaw
  try {
    run.htmlArtifact = await m.renderDesignerTemplateArtifact({
      run,
      clubName: club.name,
      language: args.language,
      designPack,
      populatedDomains: domains,
      coachPrompt: args.prompt,
    })
    run.templateRecoveredReason = reason
    m.logger.info(
      { reason: `${reason}_recovered`, htmlBytes: run.htmlArtifact.length },
      'report_v4.designer_template_recovered'
    )
    return true
  } catch (error) {
    m.logger.error({ err: error, reason }, 'report_v4.designer_template_recover_failed')
    run.htmlArtifact = null
    return false
  }
}
