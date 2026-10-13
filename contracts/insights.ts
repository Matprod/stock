import type { PredictionType, InsightTresholdType } from '#constants/insight.constants'

type InsightStatus = 'veryLow' | 'low' | 'good' | 'high' | 'veryHigh'

export interface Insight {
  label: string
  name?: string
  description?: string
  tresholdType: InsightTresholdType | null
  status: InsightStatus
  optimalValue: number | null
  value: number | null
  recommendation?: string
  maximum: number | null
  tresholdHigh: number | null
  tresholdTooHigh: number | null
  tresholdLow: number | null
  tresholdTooLow: number | null
}

export interface NewInsight {
  label: string
  description?: string
  tresholdType: InsightTresholdType | null
  value: number
  optimalValue: number | null
  maximum: number
  tresholdHigh: number | null
  tresholdTooHigh: number | null
  tresholdLow: number | null
  tresholdTooLow: number | null
  type: 'health' | 'nutrition' | 'activity' | 'sleep'
  fb: number | null
  fh: number | null
  shapValue: number | null
}

export interface NewInsightWithPriority extends NewInsight {
  priority: number | null
}

interface BaseInsight {
  insights: Array<NewInsight>
  score?: number
}

interface ActivityInsight extends BaseInsight {}

interface SleepInsight extends BaseInsight {}

interface NutritionInsight extends BaseInsight {}

interface HealthInsight extends BaseInsight {}

export interface Insights {
  athleteId: string
  performanceScore: number | null
  injuryScore: number | null
  activityInsight: ActivityInsight
  sleepInsight: SleepInsight
  nutritionInsight: NutritionInsight
  healthInsight: HealthInsight
}

// API V1 Recommendations
export interface APIV1Recommendation {
  text: string
  title: string
  status: string
  color: 'red' | 'orange' | 'green'
  field_name: Array<string>
  // warning is rich text
  warning: string
}

interface APIV1RecommendationCategory {
  score: number | null
  recommendations: Array<APIV1Recommendation>
}

export interface APIV1RecommendationsResponse {
  sport: APIV1RecommendationCategory
  sleep: APIV1RecommendationCategory
  nutrition: APIV1RecommendationCategory
  health: APIV1RecommendationCategory
  final_score: number | null
}

export interface CalculatePriorityRankingParams {
  insights: NewInsight[]
  featureImportances: Array<{ insightId: string }>
  shapValueMap: Map<string, number | null>
  clubId: string
  type: PredictionType
}
