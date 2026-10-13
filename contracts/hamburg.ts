export type HamburgMlSingleDateRequest = {
  date: string
  start_date?: never
  end_date?: never
  athlete_ids?: string[]
  club_id?: string
}

export type HamburgMlDateRangeRequest = {
  date?: never
  start_date: string
  end_date: string
  athlete_ids?: string[]
  club_id?: string
}

export type HamburgMlRequest = HamburgMlSingleDateRequest | HamburgMlDateRangeRequest

export type HamburgMlStage =
  | 'statsports-complete'
  | 'merge'
  | 'injury-history'
  | 'subjective-imputation'
  | 'daily-factors'
  | 'enrich'
  | 'diagnostik'
  | 'load-features'
  | 'predict/injury'
  | 'predict/performance-v1'

export type HamburgMlMetricValue = {
  id?: string
  metric: string
  value: number | string | null
}

export type HamburgMlPeriod = {
  id: string | null
  sport_activity_id?: string | null
  sport_activity?: { id: string } | null
  metrics: HamburgMlMetricValue[]
}

export type HamburgMlDay = {
  id?: string | null
  date?: string | null
  metrics: HamburgMlMetricValue[]
}

export type HamburgMlPlayer = {
  id: string
  periods?: HamburgMlPeriod[]
  days?: HamburgMlDay[]
}

export type HamburgMlResponse = {
  data: HamburgMlPlayer[]
  n_players: number
  n_periods: number
  stage: string
  format: 'db'
  club_id: string
  club_slug: string
}

export type HamburgMlCallOptions = {
  clubRef?: string
  skipPersist?: boolean
  dumpPath?: string
}

export type HamburgMlDailyScoresResult = {
  from: string
  to: string
  clubId: string
  stages: HamburgMlStage[]
  reports: {
    generated: number
    failed: number
    eligible: number
    skippedNoScore: number
    skippedFilter: number
  }
}

export type HamburgMlRunResult =
  | HamburgMlPlayer[]
  | HamburgMlInjuryPredictionRow[]
  | HamburgMlPerformancePredictionRow[]

export type HamburgMlSubjectiveSlug =
  | 'training_rpe'
  | 'body_soreness_rating'
  | 'sleep_quality_rating'
  | 'mood_rating'
  | 'injury_status'
  | 'at_it_rt_rpe'

export type HamburgMlHealthRatingField = 'moodRating' | 'bodySorenessRating'

export type HamburgMlHealthMetricName = 'training_rpe' | 'injury_status' | 'at_it_rt_rpe'

export type HamburgMlSubjectiveTarget =
  | { kind: 'health_rating'; field: HamburgMlHealthRatingField }
  | { kind: 'sleep'; field: 'qualityRating' }
  | { kind: 'health_metric'; metric: HamburgMlHealthMetricName }

export type HamburgMlSubjectiveDayRow = {
  athleteId: string
  dayId: string | null
  dateOfDay: string | null
  healthRatings: Partial<Record<HamburgMlHealthRatingField, number>>
  healthMetrics: Partial<Record<HamburgMlHealthMetricName, number>>
  sleepQuality: number | null
}

export type HamburgMlProcessedMetricEntry = {
  period_id: string
  metric_id: string
  value: string
}

export type HamburgMlHealthMetricValueEntry = {
  healthId: string
  metricId: string
  value: string
}

export type HamburgMlDayMetricValueEntry = {
  dayId: string
  metricId: string
  value: string
}

export type HamburgMlDailyFactorsDayRow = {
  athleteId: string
  dayId: string | null
  dateOfDay: string | null
  metrics: Record<string, number>
}

export type HamburgMlInjuryFeatureType = 'activity' | 'health' | 'sleep'

export type HamburgMlInjuryFeatureImportance = {
  name: string
  value: number | null
  optimal?: number | null
  shap_value?: number | null
  pct_contrib?: number | null
  contrib_pct?: number | null
  conrib_pct?: number | null
  type: HamburgMlInjuryFeatureType
  method?: string
}

export type HamburgMlInjuryOptimalFeature = {
  feature: string
  type: HamburgMlInjuryFeatureType
  value: number | null
}

export type HamburgMlInjuryPredictionRow = {
  id?: string | null
  player_id?: string | null
  PersonId?: string | null
  date?: string | null
  date_of_day?: string | null
  season?: string | null
  injury_risk_proba: number | string | null
  score_activity?: number | null
  score_health?: number | null
  score_sleep?: number | null
  threshold?: number | null
  feature_importances?: HamburgMlInjuryFeatureImportance[]
  optimal_features?: HamburgMlInjuryOptimalFeature[]
}

export type HamburgMlPerformanceFeatureMethod = 'dice' | 'median_fallback' | string

export type HamburgMlPerformanceFeatureImportance = {
  name: string
  value: number | null
  optimal: number | null
  shap_value: number
  type: HamburgMlInjuryFeatureType
  contrib_pct: number
  method: HamburgMlPerformanceFeatureMethod
}

export type HamburgMlPerformanceOptimalFeature = {
  feature: string
  value: number | null
  shap_value: number
  type: HamburgMlInjuryFeatureType
}

export type HamburgMlPerformancePredictionRow = {
  id: string
  PersonId: string
  date: string
  score_overall: number
  activity_score: number
  health_score: number
  sleep_score: number
  feature_importances: HamburgMlPerformanceFeatureImportance[]
  optimal_features: HamburgMlPerformanceOptimalFeature[]
}

export type HamburgMlPerformancePredictionResponse = {
  rows: HamburgMlPerformancePredictionRow[]
  n_rows: number
  model: 'performance-v1' | string
  club_id: string
}
