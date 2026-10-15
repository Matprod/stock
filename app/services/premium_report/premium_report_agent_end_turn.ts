import type { Message } from '#utils/agent/agent_logger'
import type { PremiumReportState } from '#services/premium_report/premium_report_tools'
import type { PremiumReportTokenUsage } from '#services/premium_report/premium_report_log'
import type { PremiumAgentResult } from '#services/premium_report/premium_report_agent_types'

export const simpleError = (state: PremiumReportState): string =>
  state.language === 'fr' ? 'Une erreur est survenue.' : 'Something went wrong.'

export type EndTurnNudgeState = {
  idleRetried: boolean
  unchangedRetried: boolean
  endTurnNudges: number
}

export const handlePremiumEndTurn = (args: {
  messages: Message[]
  turnContent: Message['content']
  iterationText: string
  iteration: number
  toolsEnabled: boolean
  state: PremiumReportState
  startBlocksSnap: string
  startDatasetCount: number
  nudgeState: EndTurnNudgeState
  minIterations: number
  maxEndTurnNudges: number
  continuePrompt: string
  acceptEndTurn?: (state: PremiumReportState) => string | null
  totals: PremiumReportTokenUsage
  maxIterations: number
  forceAnswerAt: number
}): { action: 'continue' } | { action: 'return'; result: PremiumAgentResult } => {
  const canvasUnchanged =
    JSON.stringify(args.state.document.blocks) === args.startBlocksSnap &&
    args.state.datasets.size === args.startDatasetCount
  const noToolsYet = args.state.toolHistory.length === 0
  const finishResult = (message: string): PremiumAgentResult => ({
    message,
    iterations: args.iteration,
    usage: { ...args.totals },
    stopClass: args.toolsEnabled ? 'self_ended' : 'force_answer_at',
    maxIterations: args.maxIterations,
    forceAnswerAt: args.forceAnswerAt,
  })

  if (args.toolsEnabled && args.state.mustUseTools && noToolsYet && !args.nudgeState.idleRetried) {
    args.nudgeState.idleRetried = true
    args.messages.push({ role: 'assistant', content: args.turnContent })
    args.messages.push({ role: 'user', content: 'Continue.' })
    return { action: 'continue' }
  }
  if (
    args.toolsEnabled &&
    args.state.mustUseTools &&
    canvasUnchanged &&
    !args.nudgeState.unchangedRetried
  ) {
    args.nudgeState.unchangedRetried = true
    args.messages.push({ role: 'assistant', content: args.turnContent })
    args.messages.push({ role: 'user', content: 'Continue.' })
    return { action: 'continue' }
  }
  const rejectMsg = args.toolsEnabled ? (args.acceptEndTurn?.(args.state) ?? null) : null
  if (rejectMsg) {
    const briefGate = /commit_report_brief|report\s*brief|hasBrief/i.test(rejectMsg)
    if (!briefGate && args.nudgeState.endTurnNudges >= args.maxEndTurnNudges) {
      return {
        action: 'return',
        result: finishResult(args.iterationText.trim() || simpleError(args.state)),
      }
    }
    args.nudgeState.endTurnNudges += 1
    args.messages.push({ role: 'assistant', content: args.turnContent })
    args.messages.push({ role: 'user', content: rejectMsg })
    return { action: 'continue' }
  }
  if (
    args.toolsEnabled &&
    !args.acceptEndTurn &&
    args.iteration < args.minIterations &&
    args.nudgeState.endTurnNudges < args.maxEndTurnNudges
  ) {
    args.nudgeState.endTurnNudges += 1
    args.messages.push({ role: 'assistant', content: args.turnContent })
    args.messages.push({
      role: 'user',
      content: `${args.continuePrompt} (${args.iteration}/${args.minIterations} min turns)`,
    })
    return { action: 'continue' }
  }
  return {
    action: 'return',
    result: finishResult(args.iterationText.trim() || simpleError(args.state)),
  }
}
