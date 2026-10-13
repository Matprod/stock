export type PlayerPosition = 'FORWARD' | 'MIDFIELDER' | 'DEFENDER' | 'GOALKEEPER'

export interface TrainingLoadPayload {
  distance?: number
  distance0_7kmh?: number
  distance7_15kmh?: number
  distance15_20kmh?: number
  distance20_25kmh?: number
  distanceAbove25kmh?: number
  numberOfEffortsAbove15kmh?: number
  numberOfEffortsAbove20kmh?: number
  numberOfEffortsAbove25kmh?: number
  topSpeed?: number
  playerPosition?: string
  maxAcceleration?: number
  maxDeceleration?: number
  numberOfAccelerationsAbove3mPerS2?: number
  numberOfDecelerationsAbove3mPerS2?: number
}

export interface TrainingLoadPayloadFormatted {
  'Total_distance': string
  'Distance__0_7_km_h': string
  'Distance__7_15_km_h': string
  'Distance__15_20_km_h': string
  'Distance__20_25_km_h': string
  'Distance___25_km_h': string
  'Nb_Efforts___15_km_h': string
  'Nb_Efforts___19_8_km_h': string
  'Nb_Efforts___25_km_h': string
  'Top_speed': string
  'player_position': string
  'Max_acceleration': string
  'Max_deceleration': string
  'Nb_acc___3_0m_s²': string
  'Nb_dec___3_0m_s²': string
}

export interface TrainingLoadResponse {
  TL_load: Array<number>
  TL_high_intensity: Array<number>
}

export interface InjuryPayload {
  playerName: string
  date: string
  playerPosition: string
  totalMatches: number
  gameDay: boolean
  numberOfMatchesLast7Days: number
  numberOfTrainingsToday: number
  numberOfTrainingsLast7Days: number
  weight: number
  height: number
  bodyMassIndex: number
  bodyFatPercentage: number
  age: number
  stress?: number
  stressLast7Days?: number
  stressVarianceLast7Days: number
  aches?: number
  achesLast7Days?: number
  achesVarianceLast7Days: number
  sleep?: number
  sleepLast7Days?: number
  sleepVarianceLast7Days: number
  sleepVarianceLast30Days: number
  fatigue?: number
  fatigueLast7Days?: number
  fatigueVarianceLast30Days: number
  sessionsDuration: number
  lastPerformanceScore?: number
  lastPerformanceScoreLast7Days: number
  calories: number
  rpeWorkload: number
  rpeWorkloadLast7Days: number
  rpeWorkloadLast30Days: number
  acwr: number
  trainingLoad: number
  trainingLoadHighIntensity: number
  ewmaTrainingLoadLast7Days: number
  ewmaTrainingLoadLast30Days: number
  ewmaTrainingLoadHighIntensityLast7Days: number
  ewmaTrainingLoadHighIntensityLast30Days: number
  stdTrainingLoadLast7Days: number
  stdTrainingLoadHighIntensityLast7Days: number
  monotonyEwmaStdTrainingLoadLast7Days: number
  acwrExpTrainingLoad: number
  deltaTrainingLoad: number
  deltaTrainingLoadHighIntensity: number
  deltaAches: number
  deltaFatigue: number
  deltaSleep: number
  deltaStress: number
  deltaRpeWorkload: number
  daysSinceLastInjury: number
  injuryVerySeverePastSeasons: number
  countLightInjuryHistory: number
  countMediumInjuryHistory: number
  countSeriousInjuryHistory: number
  countVerySeriousInjuryHistory: number
  injuryBurden: number
  injuryBurdenPerAge: number
}

export interface InjuryPayloadFormatted {
  player_position: string
  Total_matches: string
  Game_day_Y_N: string
  Game_day_Y_N_7: string
  Number_of_trainings: string
  Number_training_7: string
  Weight: string
  Height: string
  BMI: string
  Fat_Percentage: string
  Age: string
  Stress: string
  Stress_7: string
  Stress_variance_7: string
  Aches: string
  Aches_7: string
  Aches_variance_7: string
  Sleep: string
  Sleep_7: string
  Sleep_variance_7: string
  Sleep_variance_30: string
  Fatigue__pre_event_: string
  Fatigue_7: string
  Fatigue_variance_30: string
  Session_duration: string
  last_performance: string
  last_performance_7: string
  Calories: string
  RPE_Workload: string
  RPE_Workload_7: string
  RPE_Workload_30: string
  ACWR: string
  TL_load: string
  TL_high_intensity: string
  EMA_TL_7: string
  EMA_TL_30: string
  EMA_TL_high_intensity_7: string
  EMA_TL_high_intensity_30: string
  std_TL_load_7: string
  std_TL_high_intensity_7: string
  monotony_ewma_std_TL_7: string
  ACWR_exp_TL: string
  delta_TL_load: string
  delta_TL_high_intensity: string
  delta_aches: string
  delta_fatigue: string
  delta_sleep: string
  delta_stress: string
  delta_rpe: string
  days_since_last_injury: string
  injury_very_severe_past_seasons: string
  count_light_injury_history: string
  count_medium_injury_history: string
  count_serious_injury_history: string
  count_very_serious_injury_history: string
  injury_burden: string
  injury_burden_per_age: string
  date: string
  player_name: string
}

export interface PerformanceScorePayload {
  playerName: string
  date: string
  playerPosition: string
  totalMatches: number
  gameDay: boolean
  numberOfMatchesLast7Days: number
  numberOfTrainingsToday: number
  numberOfTrainingsLast7Days: number
  weight: number
  height: number
  bodyMassIndex: number
  bodyFatPercentage: number
  age: number
  stress?: number
  stressVarianceLast7Days: number
  aches?: number
  achesVarianceLast7Days: number
  sleep?: number
  sleepVarianceLast7Days: number
  sleepVarianceLast30Days: number
  fatigue?: number
  fatigueVarianceLast30Days: number
  sessionsDuration: number
  lastPerformanceScore?: number
  ewmaPerformanceScoreLast7Days: number
  calories: number
  rpeWorkload: number
  ewmaRPEWorkloadLast7Days: number
  acwr: number
  trainingLoad: number
  trainingLoadHighIntensity: number
  ewmaTrainingLoadLast7Days: number
  ewmaTrainingLoadHighIntensityLast7Days: number
  ewmaTrainingLoadHighIntensityLast30Days: number
  stdTrainingLoadLast7Days: number
  stdTrainingLoadHighIntensityLast7Days: number
  monotonyEwmaStdTrainingLoadLast7Days: number
  acwrExpTrainingLoad: number
  deltaTrainingLoad: number
  deltaTrainingLoadHighIntensity: number
  deltaAches: number
  deltaFatigue: number
  deltaSleep: number
  deltaStress: number
  deltaRpeWorkload: number
}

export interface PerformanceScorePayloadFormatted {
  player_position: string
  Total_matches: string
  Game_day_Y_N: string
  Game_day_Y_N_7: string
  Number_of_trainings: string
  Number_training_7: string
  Weight: string
  Height: string
  BMI: string
  Fat_Percentage: string
  Age: string
  Stress: string
  Stress_variance_7: string
  Aches: string
  Aches_variance_7: string
  Sleep: string
  Sleep_variance_7: string
  Sleep_variance_30: string
  Fatigue__pre_event_: string
  Fatigue_variance_30: string
  Session_duration: string
  last_performance: string
  last_performance_7: string
  Calories: string
  RPE_Workload: string
  RPE_Workload_7: string
  ACWR: string
  TL_load: string
  TL_high_intensity: string
  EMA_TL_7: string
  EMA_TL_high_intensity_7: string
  EMA_TL_high_intensity_30: string
  std_TL_load_7: string
  std_TL_high_intensity_7: string
  monotony_ewma_std_TL_7: string
  ACWR_exp_TL: string
  delta_TL_load: string
  delta_TL_high_intensity: string
  delta_aches: string
  delta_fatigue: string
  delta_sleep: string
  delta_stress: string
  delta_rpe: string
  date: string
  player_name: string
}

export interface ImputationPayload {
  calories?: number
  totalDistance?: number
  distance0_7kmh?: number
  distance7_15kmh?: number
  distance15_20kmh?: number
  distance20_25kmh?: number
  distanceAbove25kmh?: number
  numberOfEffortsAbove15kmh?: number
  numberOfEffortsAbove20kmh?: number
  numberOfEffortsAbove25kmh?: number
  topSpeed?: number
  maxAcceleration?: number
  maxDeceleration?: number
  numberOfDecelerationsAbove3mPerS2?: number
  numberOfAccelerationsAbove3mPerS2?: number
  sessionDuration?: number
  weight: number
  fatPercentage?: number
  stress?: number
  aches?: number
  fatiguePreEvent?: number
  sleep?: number
  rpe?: number
  playerName: string
  date: string
}

export interface ImputationPayloadFormatted {
  'Calories': string
  'Total_distance': string
  'Distance__0_7_km_h': string
  'Distance__7_15_km_h': string
  'Distance__15_20_km_h': string
  'Distance__20_25_km_h': string
  'Distance___25_km_h': string
  'Nb_Efforts___15_km_h': string
  'Nb_Efforts___19_8_km_h': string
  'Nb_Efforts___25_km_h': string
  'Top_speed': string
  'Max_acceleration': string
  'Max_deceleration': string
  'Nb_dec___3_0m_s²': string
  'Nb_acc___3_0m_s²': string
  'Session_duration': string
  'Weight': string
  'Fat_Percentage': string
  'Stress': string
  'Aches': string
  'Fatigue__pre_event_': string
  'Sleep': string
  'RPE': string
  'player_name': string
  'date': string
}

export interface PerformanceScoreResponse {
  performance_score: Array<number>
  score_activity: Array<number>
  score_health: Array<number>
  score_sleep: Array<number>
}

export interface FeatureImportance {
  value: number
  optimal: number
  shap_value: number
}

export interface PerformanceScoreAllResponse {
  performance_score: number
  performance_score_v2: number
  score_activity: number
  score_health: number
  score_sleep: number
  top_features_activity_improve: Record<string, FeatureImportance>
  top_features_health_improve: Record<string, FeatureImportance>
  top_features_sleep_improve: Record<string, FeatureImportance>
  optimal_features_activity: Array<string>
  optimal_features_health: Array<string>
  optimal_features_sleep: Array<string>
}

export interface InjuryScoreResponse {
  Injury_score: Array<number>
  score_activity: Array<number>
  score_health: Array<number>
  score_sleep: Array<number>
}

export interface InjuryScoreAllResponse {
  Injury_score: number
  Injury_score_v2: number
  score_activity: number
  score_health: number
  score_sleep: number
  top_features_activity_improve: Record<string, FeatureImportance>
  top_features_health_improve: Record<string, FeatureImportance>
  top_features_sleep_improve: Record<string, FeatureImportance>
  optimal_features_activity: Array<string>
  optimal_features_health: Array<string>
  optimal_features_sleep: Array<string>
}

export interface ImputationResponse {
  'player_name': string
  'Top_speed': number
  'Fat_Percentage': number
  'Stress': number
  'Sleep': number
  'RPE': number
  'Calories': number
  'Session_duration': number
  'Nb_Efforts___25_km_h': number
  'Distance__7_15_km_h': number
  'Distance__0_7_km_h': number
  'Distance__15_20_km_h': number
  'Total_distance': number
  'Max_deceleration': number
  'Nb_dec___3_0m_s²': number
  'Nb_acc___3_0m_s²': number
  'Max_acceleration': number
  'Nb_Efforts___15_km_h': number
  'Nb_Efforts___19_8_km_h': number
  'Distance__20_25_km_h': number
  'Distance___25_km_h': number
  'Weight': number
  'Aches': number
  'Fatigue__pre_event_': number
  'imputation_status': 'imputed' | 'not imputed'
}
