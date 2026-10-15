import type { PremiumDomain } from '#constants/premium_report_domains'
import type { ClubSeasonRef } from '#services/report_v4/club_seasons'
import type { PromptWindows } from '#services/report_v4/prompt_scope'
import {
  analyzeRequestWithLlm,
  type AnalyzeRequestLlmBundle,
} from '#services/report_v4/prompt_windows_llm'
import type { ReportV4SessionFocus } from '#services/report_v4/session_focus'

type AnalyzeRequestResult = {
  windows: PromptWindows
  askDomains: PremiumDomain[]
  periodFollowUp: boolean
  multiSection: boolean
  provider: AnalyzeRequestLlmBundle['provider']
}

type AnalyzeRequestOpts = {
  seasons?: ClubSeasonRef[]
  sessionFocus?: ReportV4SessionFocus | null
  priorUserAsks?: string[]
  fallbackDays?: number
  timeZone?: string
  today?: string
}

export const analyzeRequest = async (
  prompt: string,
  opts?: AnalyzeRequestOpts
): Promise<AnalyzeRequestResult> => {
  const bundle = await analyzeRequestWithLlm(prompt, opts)
  return {
    windows: bundle.windows,
    askDomains: bundle.askDomains,
    periodFollowUp: bundle.periodFollowUp,
    multiSection: bundle.multiSection,
    provider: bundle.provider,
  }
}
