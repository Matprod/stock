import type { PremiumReportTokenUsage } from '#services/premium_report/premium_report_log'

export type { PremiumReportTokenUsage }

export type PremiumAgentIterationEvent = {
  iteration: number
  stopReason: string
  durationSec: number
  usage: PremiumReportTokenUsage
  cumulative: PremiumReportTokenUsage
  tools: Array<{ name: string; ok: boolean; detail?: string; durationSec?: number }>
  textPreview?: string
}

export type PremiumAgentStopClass = 'self_ended' | 'force_answer_at' | 'max_reached'

export type PremiumAgentResult = {
  message: string
  iterations: number
  usage: PremiumReportTokenUsage
  stopClass: PremiumAgentStopClass
  maxIterations: number
  forceAnswerAt: number
}
