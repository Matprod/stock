import type { PipelineState } from '#services/report_v4/orchestrator/pipeline_state'
import { runDesignerCompose } from '#services/report_v4/orchestrator/steps/compose_designer'

export const composeArtifact = async (state: PipelineState): Promise<void> => {
  await runDesignerCompose(state)
}
