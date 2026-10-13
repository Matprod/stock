export const SUBJECTIVE_VARIABLE_DOMAIN = {
  SPORT_ACTIVITY: 'sport_activity',
  HEALTH_RATING: 'health_rating',
  HEALTH_METRIC: 'health_metric',
  SLEEP: 'sleep',
} as const

export type SubjectiveVariableDomain =
  (typeof SUBJECTIVE_VARIABLE_DOMAIN)[keyof typeof SUBJECTIVE_VARIABLE_DOMAIN]

export const SUBJECTIVE_VARIABLE_DOMAINS = Object.values(
  SUBJECTIVE_VARIABLE_DOMAIN
) as SubjectiveVariableDomain[]

export const SUBJECTIVE_DISPLAY_CONTEXT = {
  ACTIVITY: 'activity',
  WELLNESS: 'wellness',
} as const

export type SubjectiveDisplayContext =
  (typeof SUBJECTIVE_DISPLAY_CONTEXT)[keyof typeof SUBJECTIVE_DISPLAY_CONTEXT]

export function subjectiveDomainToDisplayContext(
  domain: SubjectiveVariableDomain
): SubjectiveDisplayContext {
  return domain === SUBJECTIVE_VARIABLE_DOMAIN.SPORT_ACTIVITY
    ? SUBJECTIVE_DISPLAY_CONTEXT.ACTIVITY
    : SUBJECTIVE_DISPLAY_CONTEXT.WELLNESS
}
