import logger from '@adonisjs/core/services/logger'
import {
  collectArtifactCharts,
  collectArtifactTables,
} from '#services/report_v4/artifact_html'
import { type DesignerToolArgs } from '#services/report_v4/agents/designer_tools_fallback'
import {
  buildSetHtmlGroundingCtx,
  commitSetHtmlEmergency,
  repairAndGateSetHtmlGrounding,
} from '#services/report_v4/agents/designer_tools_set_html_grounding'
import {
  finalizeSetReportHtml,
  type SetReportHtmlState,
} from '#services/report_v4/agents/designer_tools_set_html_hosts'

export type { SetReportHtmlState }

type DesignerWellnessScale = {
  field: string
  label: string
  domain: string
  min: number
  max: number
  isReversed: boolean
  higherIsBetter: boolean
}

export const executeSetReportHtml = async (args: {
  input: Record<string, unknown>
  toolArgs: DesignerToolArgs & {
    wellnessScales?: DesignerWellnessScale[]
  }
  state: SetReportHtmlState
}): Promise<string> => {
  const { toolArgs, state } = args
  const bumpReject = () => {
    state.freeHtmlRejects += 1
    toolArgs.run.htmlArtifact = null
  }
  const emergency = async (reason: string, rejectPayload: Record<string, unknown>) =>
    commitSetHtmlEmergency({ toolArgs, state, reason, rejectPayload })

  try {
    const raw = typeof args.input.html === 'string' ? args.input.html.trim() : ''
    const charts = collectArtifactCharts(
      toolArgs.run.agentState.document,
      toolArgs.run.agentState.heatScales
    )
    const tables = collectArtifactTables(toolArgs.run.agentState.document)
    const ctx0 = buildSetHtmlGroundingCtx({ raw, toolArgs, charts })
    const gated = await repairAndGateSetHtmlGrounding({
      ctx: ctx0,
      toolArgs,
      state,
      bumpReject,
      emergency,
    })
    if (typeof gated === 'string') return gated
    return await finalizeSetReportHtml({
      ctx: gated,
      toolArgs,
      state,
      charts,
      tables,
      bumpReject,
      emergency,
    })
  } catch (error) {
    bumpReject()
    logger.error({ err: error }, 'report_v4.set_report_html_exception')
    return await emergency('set_report_html_exception', {
      error: 'set_report_html raised an exception',
    })
  }
}
