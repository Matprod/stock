import {
  PREMIUM_DOMAIN,
  PREMIUM_DOMAINS,
  type PremiumDomain,
} from '#constants/premium_report_domains'

export const ASK_FAITHFUL_NOTE = [
  'Ask-faithful: include ONLY domains the coach asked for (or clearly required joins).',
  'NEGATIVE EXAMPLE: "report on my team" (any language) + performance_score + injury scores + individual line charts + team mean/min/max → domains ≈ [scores] only.',
  'Do NOT include biomarkers, wellness, sleep, gps, or load unless the coach asked (load only for ACWR/sRPE/load volume).',
  'Generic team report wording does NOT unlock the full populated stack.',
  'coverRange-only / December biomarkers / wellness / sleep / gps only if asked.',
].join(' ')

export const COACH_REPORT_SHAPE = {
  FREE: 'free',
  MONITORING_PLAYBOOK: 'monitoring_playbook',
  SQUAD_OVERVIEW: 'squad_overview',
  INDIVIDUAL_FOCUS: 'individual_focus',
} as const

export type CoachReportShape = (typeof COACH_REPORT_SHAPE)[keyof typeof COACH_REPORT_SHAPE]

export const COACH_LOAD_FLAG = {
  ACWR_EWMA: 'acwr_ewma',
  COUPLED_7_28: 'coupled_7_28',
  VOLUME_ONLY: 'volume_only',
  NONE: 'none',
} as const

export type CoachLoadFlag = (typeof COACH_LOAD_FLAG)[keyof typeof COACH_LOAD_FLAG]

export type CoachPromptPolicy = {
  excludedDomains: PremiumDomain[]
  preferredDomains: PremiumDomain[]
  reportShape: CoachReportShape
  loadFlag: CoachLoadFlag
  wantsVald: boolean
  wantsMatch: boolean
  wantsAvailability: boolean
  allowWellnessInference: boolean
  allowNutritionScope: boolean
  flagsAreDescriptiveOnly: boolean
  sectionOrder: string[]
  monitoringPlaybook: boolean
  acwrWatchlist: boolean
  provider: 'jev' | 'haiku'
  confidence?: number
  monitoringPlaybookReason: string
}

export const finalizePolicy = (
  partial: Omit<
    CoachPromptPolicy,
    'monitoringPlaybook' | 'acwrWatchlist' | 'sectionOrder' | 'monitoringPlaybookReason'
  > & {
    sectionOrder?: string[]
    monitoringPlaybookReason?: string
  }
): CoachPromptPolicy => {
  const preferredDomains =
    partial.wantsAvailability && !partial.preferredDomains.includes(PREMIUM_DOMAIN.INJURY)
      ? PREMIUM_DOMAINS.filter(
          (domain) => domain === PREMIUM_DOMAIN.INJURY || partial.preferredDomains.includes(domain)
        )
      : partial.preferredDomains
  const monitoringPlaybook = partial.reportShape === COACH_REPORT_SHAPE.MONITORING_PLAYBOOK
  const monitoringPlaybookReason =
    partial.monitoringPlaybookReason ??
    (monitoringPlaybook
      ? `shape=${partial.reportShape}`
      : preferredDomains.length
        ? `ask_domains=${preferredDomains.join(',')};shape=${partial.reportShape}`
        : `shape=${partial.reportShape};not_playbook`)
  return {
    ...partial,
    preferredDomains,
    sectionOrder: partial.sectionOrder?.length ? partial.sectionOrder : [],
    monitoringPlaybook,
    acwrWatchlist: partial.loadFlag === COACH_LOAD_FLAG.ACWR_EWMA,
    monitoringPlaybookReason,
  }
}
