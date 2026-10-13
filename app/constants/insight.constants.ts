export const INSIGHT_TRESHOLD_TYPE = {
  PERCENTAGE: 'percentage',
  ABSOLUTE: 'absolute',
} as const

export type InsightTresholdType = (typeof INSIGHT_TRESHOLD_TYPE)[keyof typeof INSIGHT_TRESHOLD_TYPE]

export const INSIGHT_CATEGORIES = ['performance', 'injury'] as const
export type PredictionType = (typeof INSIGHT_CATEGORIES)[number]
