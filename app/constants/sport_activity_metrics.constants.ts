export const SPORT_ACTIVITY_METRIC_SOURCE = {
  SKILLCORNER: 'skillcorner',
  DFL: 'dfl',
  STATSPORTS: 'statsports',
  CATAPULT: 'catapult',
  MANUAL: 'manual',
} as const

export type SportActivityMetricSource =
  (typeof SPORT_ACTIVITY_METRIC_SOURCE)[keyof typeof SPORT_ACTIVITY_METRIC_SOURCE]
