import type { ReportV4OrchestratorDeps } from '#services/report_v4/orchestrator/deps'
import type { FramedAsk, ReportV4OrchestratorArgs } from '#services/report_v4/orchestrator/types'
import type { AskContractReport, AskRequirement } from '#services/report_v4/request/ask_contract'
import { frameAsk } from '#services/report_v4/request/frame_ask'

export type ResolvedReportRequest = {
  framed: FramedAsk
  askContract: AskContractReport | null
  askRequirements: AskRequirement[] | null
}

export const resolveReportRequest = async (
  args: ReportV4OrchestratorArgs,
  deps: ReportV4OrchestratorDeps
): Promise<ResolvedReportRequest> => {
  const framed = await frameAsk(args, deps)
  return {
    framed,
    askContract: null,
    askRequirements: null,
  }
}
