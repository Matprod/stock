export type SunderlandImputationPayload = Record<string, Array<string | number | null>>

export interface SunderlandImputationResponse {
  request_id: string
  latency_s: number
  rows: number
  result: Array<
    Pick<
      SunderlandDailyRow,
      | 'username_lastname'
      | 'date_of_day'
      | 'Energy'
      | 'Sleep quality'
      | 'Body Soreness'
      | 'Body Weight'
    >
  >
}

export interface SunderlandDailyRow {
  'username_lastname': string
  'date_of_day': string // YYYY-MM-DD
  'season': string | null

  'periodProviderIds': string[]
  'activityNames': string[]

  'Number_of_activities': number
  'Number_of_periods': number
  'Number_of_games': number

  'total_duration': number | null
  'duration': number | null

  'Energy': number | null
  'Sleep quality': number | null
  'Body Soreness': number | null
  'Body Weight': number | null
  'Sleep hours': number | null

  [metricName: string]: string | string[] | number | null
}

export interface ExpectedPLPeriodData {
  gen2_velocity_band1_total_distance: number
  gen2_velocity_band3_total_distance: number
  gen2_velocity_band4_total_distance: number
  gen2_velocity_band5_total_distance: number
  total_distance: number
  total_duration: number
  work_rest_ratio: number
  username_lastname?: string
  date_of_day?: string
}

export interface ExpectedPLPayload {
  data: ExpectedPLPeriodData[]
}

export interface ExpectedPLResponse {
  expected_pl: number[]
}

export interface TrainingLoadFactorsData {
  username_lastname: string
  season: string
  date_of_day: string

  total_distance: number
  gen2_velocity_band1_total_distance: number
  gen2_velocity_band2_total_distance: number
  field_time: number
  total_player_load: number
  total_1d_side_player_load: number
  total_1d_up_player_load: number
  meta_energy_kj: number
  gen2_velocity_band3_total_distance: number
  gen2_velocity_band4_total_distance: number
  gen2_velocity_band5_total_distance: number
  high_metabolic_load_distance: number
  velocity_exertion: number
  peak_meta_power: number
  fmp_dynamic_high_duration_ratio: number
  fmp_running_high_duration_ratio: number
  ima_band3_accel_count: number
  ima_band3_decel_count: number
  ima_band3_left_count: number
  ima_band3_right_count: number
  total_acceleration_load: number
  gen2_acceleration_band6plus_total_effort_count: number
  rhie_bout_count: number
  rhie_max_effort_duration: number
  rhie_max_effort_count: number
}

export interface TrainingLoadFactorsPayload {
  data: TrainingLoadFactorsData[]
}

export interface TrainingLoadFactorsResult {
  username_lastname: string
  season: string
  date_of_day: string
  TL_volume_F1: number
  TL_volume_F2: number
  TL_HI_F1: number
  TL_HI_F2: number
  TL_HI_F3: number
  TL_NM_F1: number
  TL_NM_F2: number
}

export interface TrainingLoadFactorsResponse {
  result: TrainingLoadFactorsResult[]
}

export interface FeatureImportanceItem {
  name: string
  value: number | null
  optimal: number
  shap_value: number
  conrib_pct?: number | null
  pct_contrib?: number | null
  contrib_pct?: number | null
  type: 'activity' | 'health' | 'sleep'
  method: string
}

export interface FeatureImportanceData {
  'date_of_day': string
  'player_id': string
  'username_lastname': string
  'season': string

  'Body Soreness': number
  'Body Weight': number
  'Sleep quality': number
  'Energy': number

  'TL_volume_F1': number
  'TL_volume_F2': number
  'TL_HI_F1': number
  'TL_HI_F2': number
  'TL_HI_F3': number
  'TL_NM_F1'?: number
  'TL_NM_F2'?: number

  'EWMA_7d_TL_volume_F1': number
  'EWMA_7d_TL_volume_F2': number
  'monotony_TL_volume_F2': number
  'strain_TL_volume_F2': number

  'EWMA_7d_TL_HI_F1': number
  'EWMA_7d_TL_HI_F2': number
  'monotony_TL_HI_F2': number
  'strain_TL_HI_F2': number

  'EWMA_7d_TL_HI_F3': number
  'monotony_TL_HI_F3': number
  'strain_TL_HI_F3': number

  'EWMA_7d_Sleep quality': number
  'EWMA_7d_Energy': number
  'EWMA_7d_Body Soreness': number

  'games_last_7d': number
  'sessions_last_7d': number
  'match_minutes_last_7d': number
  'HSR_sessions_last_7d': number
}

export interface FeatureImportancePayload {
  data: FeatureImportanceData[]
}

export interface FeatureImportanceResult {
  date_of_day: string
  player_id: string
  readiness_score: number
  activity_score: number
  health_score: number
  sleep_score: number
  feature_importances: FeatureImportanceItem[]
  optimal_features: Array<{
    feature: string
    type: 'activity' | 'health' | 'sleep'
    value: number | null
  }>
}

export interface FeatureImportanceResponse {
  request_id: string
  rows: number
  latency_s: number
  result: {
    result: FeatureImportanceResult[]
  }
}

export interface PerformanceScoreV2Data {
  'player_position': string
  'season': number
  'Body Weight': number

  'EWMA_7d_fmp_dynamic_high_duration_ratio': number
  'mean_7d_fmp_dynamic_high_duration_ratio': number
  'std_7d_fmp_dynamic_high_duration_ratio': number
  'monotony_fmp_dynamic_high_duration_ratio': number
  'strain_fmp_dynamic_high_duration_ratio': number

  'EWMA_7d_fmp_running_high_duration_ratio': number
  'mean_7d_fmp_running_high_duration_ratio': number
  'std_7d_fmp_running_high_duration_ratio': number
  'monotony_fmp_running_high_duration_ratio': number
  'strain_fmp_running_high_duration_ratio': number

  'EWMA_7d_TL_NM_F1': number
  'mean_7d_TL_NM_F1': number
  'std_7d_TL_NM_F1': number
  'monotony_TL_NM_F1': number
  'strain_TL_NM_F1': number

  'EWMA_7d_TL_NM_F2': number
  'EWMA_28d_TL_NM_F2': number
  'mean_7d_TL_NM_F2': number
  'std_7d_TL_NM_F2': number
  'monotony_TL_NM_F2': number
  'strain_TL_NM_F2': number

  'EWMA_28d_TL_volume_F1': number
  'EWMA_7d_TL_volume_F1': number
  'mean_7d_TL_volume_F1': number
  'std_7d_TL_volume_F1': number
  'monotony_TL_volume_F1': number
  'strain_TL_volume_F1': number

  'EWMA_28d_TL_volume_F2': number
  'EWMA_7d_TL_volume_F2': number
  'monotony_TL_volume_F2': number
  'strain_TL_volume_F2': number

  'EWMA_7d_TL_HI_F1': number
  'monotony_TL_HI_F1': number
  'strain_TL_HI_F1': number

  'EWMA_7d_TL_HI_F2': number
  'monotony_TL_HI_F2': number
  'strain_TL_HI_F2': number

  'EWMA_7d_TL_HI_F3': number
  'monotony_TL_HI_F3': number
  'strain_TL_HI_F3': number
  'ACWR_exp_TL_HI_F3': number

  'EWMA_7d_Sleep quality': number
  'EWMA_7d_Energy': number
  'EWMA_7d_Body Soreness': number

  'games_last_7d': number
  'HSR_sessions_last_7d': number
}

export interface PerformanceScoreV2Payload {
  data: PerformanceScoreV2Data[]
}

export interface PerformanceScoreV2Result {
  result: Array<{
    score_overall: number
    activity_score: number
    health_score: number
    sleep_score: number
    feature_importances: FeatureImportanceItem[]
    optimal_features: Array<{
      feature: string
      type: 'activity' | 'health' | 'sleep'
      value: number | null
    }>
  }>
}

export type InjurySeverity = 'light' | 'medium' | 'serious' | 'very_serious'

export interface InjuryHistoryVariables {
  count_light_injury_history: number
  count_medium_injury_history: number
  count_serious_injury_history: number
  count_very_serious_injury_history: number
  days_since_last_injury: number
  frequency_injury_per_season: number | null
  injury_burden: number
  injury_severe_past_seasons: number | null
  injury_very_severe_past_seasons: number | null
}

export interface InjuryPredictionData {
  'username_lastname': string
  'season': string
  'date_of_day': string
  'player_id': string
  'player_position': string
  'age': number
  'Energy': number | null
  'EWMA_7d_Energy': number
  'Sleep quality': number | null
  'EWMA_7d_Sleep quality': number | null
  'Body Soreness': number | null
  'EWMA_7d_Body Soreness': number
  'Body Weight': number | null
  'TL_volume_F1': number
  'TL_volume_F2': number
  'EWMA_7d_TL_volume_F1': number
  'EWMA_7d_TL_volume_F2': number
  'EWMA_28d_TL_volume_F1': number
  'EWMA_28d_TL_volume_F2': number
  'ACWR_exp_TL_volume_F1': number
  'ACWR_exp_TL_volume_F2': number
  'monotony_TL_volume_F1': number | null
  'monotony_TL_volume_F2': number | null
  'strain_TL_volume_F1': number | null
  'strain_TL_volume_F2': number | null
  'spike_TL_volume_F1': number
  'spike_TL_volume_F2': number
  'TL_HI_F1': number
  'TL_HI_F2': number
  'TL_HI_F3': number
  'EWMA_7d_TL_HI_F1': number
  'EWMA_7d_TL_HI_F2': number
  'EWMA_7d_TL_HI_F3': number
  'EWMA_28d_TL_HI_F1': number
  'EWMA_28d_TL_HI_F2': number
  'EWMA_28d_TL_HI_F3': number
  'ACWR_exp_TL_HI_F1': number
  'ACWR_exp_TL_HI_F2': number
  'ACWR_exp_TL_HI_F3': number
  'monotony_TL_HI_F1': number | null
  'monotony_TL_HI_F2': number | null
  'strain_TL_HI_F1': number | null
  'strain_TL_HI_F2': number | null
  'spike_TL_HI_F1': number
  'spike_TL_HI_F2': number
  'spike_TL_HI_F3': number
  'TL_NM_F1': number
  'TL_NM_F2': number
  'EWMA_7d_TL_NM_F1': number
  'EWMA_7d_TL_NM_F2': number
  'EWMA_28d_TL_NM_F1': number
  'EWMA_28d_TL_NM_F2': number
  'ACWR_exp_TL_NM_F1': number
  'ACWR_exp_TL_NM_F2': number
  'monotony_TL_NM_F1': number | null
  'monotony_TL_NM_F2': number | null
  'strain_TL_NM_F1': number | null
  'strain_TL_NM_F2': number | null
  'spike_TL_NM_F1': number
  'spike_TL_NM_F2': number
  'std_7d_TL_HI_F3': number | null
  'std_7d_fmp_dynamic_high_duration_ratio': number | null
  'monotony_fmp_dynamic_high_duration_ratio': number | null
  'rhie_max_effort_count': number
  'games_last_7d': number
  'sessions_last_7d': number
  'match_minutes_last_7d': number
  'HSR_sessions_last_7d': number
  'days_since_last_injury': number
  'frequency_injury_per_season': number | null
  'injury_burden': number
  'count_light_injury_history': number
  'count_medium_injury_history': number
  'count_serious_injury_history': number
  'count_very_serious_injury_history': number
  'injury_severe_past_seasons': number | null
  'injury_very_severe_past_seasons': number | null
}

export interface InjuryPredictionPayload {
  data: InjuryPredictionData[]
}

export interface InjuryPredictionResult {
  date_of_day: string
  player_id: string
  username_lastname: string
  season: string
  injury_risk_proba: number
  score_activity: number
  score_health: number
  score_sleep: number
  threshold: number
  feature_importances: FeatureImportanceItem[]
  optimal_features: Array<{
    feature: string
    type: 'activity' | 'health' | 'sleep'
    value: number | null
  }>
}

export interface InjuryPredictionResponse {
  request_id: string
  rows: number
  latency_s: number
  result: InjuryPredictionResult[]
}
