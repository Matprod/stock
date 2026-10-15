import type { PremiumReportTokenUsage } from '#services/premium_report/premium_report_log'

export type ReportRunAgentCost = {
  agent: string
  iterations: number
  durationSec: number
  usage: PremiumReportTokenUsage
  detail?: string
}

export type ReportRunJournalEntry = {
  at: string
  level: 'info' | 'warn' | 'error'
  message: string
  data?: Record<string, unknown>
}

export const formatRunTimingLine = (
  costs: ReportRunAgentCost[],
  extra?: Array<{ step: string; durationSec: number }>
): string => {
  const parts = [
    ...costs.map((row) => `${row.agent}=${row.durationSec.toFixed(1)}s`),
    ...(extra ?? []).map((row) => `${row.step}=${row.durationSec.toFixed(1)}s`),
  ]
  return parts.length ? `run_timing ${parts.join(' ')}` : 'run_timing none'
}
