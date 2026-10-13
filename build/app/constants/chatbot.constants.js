export const SUNDERLAND_CLUB_IDS = [
    '019f5371-fdc5-74eb-905b-680aac4205ca',
    '019f1fff-20d5-7aaf-818b-5781b0001569',
];
export const HAMBURG_CLUB_ID = '019fa7cc-684c-783e-9609-c132a26eb4e3';
export const READING_FC_CLUB_ID = '01a09f51-d189-766d-9bdc-a58588346eb6';
export const CHATBOT_ML_CLUB_IDS = [...SUNDERLAND_CLUB_IDS, HAMBURG_CLUB_ID];
export const CATEGORY_REPORT_FOCUS = {
    performance: 'Consigne: génère UNIQUEMENT le rapport PERFORMANCE du jour. Les sections Injury servent de contexte.',
    injury: 'Consigne: génère UNIQUEMENT le rapport INJURY / risque de blessure. Les sections Performance servent de contexte.',
};
export function isSunderlandClub(clubId) {
    return clubId != null && SUNDERLAND_CLUB_IDS.includes(clubId);
}
export function isChatbotMlClub(clubId) {
    return clubId != null && CHATBOT_ML_CLUB_IDS.includes(clubId);
}
export function isHamburgClub(clubId) {
    return clubId === HAMBURG_CLUB_ID;
}
export function isReadingFcClub(clubId) {
    return clubId === READING_FC_CLUB_ID;
}
export function usesStatsportsMetricWhitelist(clubId) {
    return isHamburgClub(clubId) || isReadingFcClub(clubId);
}
export const CHATBOT_FILTERED_PERIOD_METRICS = [
    'average_time_to_feet',
    'delta_pl',
    'average_gnss_quality',
    'average_hdop',
    'average_satellite_count',
    'total_dive_load_med_intensity',
    'total_dive_load_high_intensity',
    'heart_rate_band1_total_duration',
    'heart_rate_band2_total_duration',
    'heart_rate_band3_total_duration',
    'heart_rate_band4_total_duration',
    'heart_rate_band5_total_duration',
    'heart_rate_exertion',
    'metabolic_power_band5_total_distance',
    'max_heart_rate',
    'mean_heart_rate',
    'kpi_averageHeartRate',
    'kpi_maxHeartrate',
    'kpi_hrExertion',
    'kpi_hrLoad',
    'kpi_hrrBeats',
    'kpi_hrrPercent',
    'kpi_hrv',
    'kpi_timeHeartRateZ1Rel',
    'kpi_timeHeartRateZ2Rel',
    'kpi_timeHeartRateZ2Z6Rel',
    'kpi_timeHeartRateZ3Rel',
    'kpi_timeHeartRateZ3Z6Rel',
    'kpi_timeHeartRateZ4Rel',
    'kpi_timeHeartRateZ4Z6Rel',
    'kpi_timeHeartRateZ5Rel',
    'kpi_timeHeartRateZ6Rel',
    'red zone',
];
export const CHATBOT_METRIC_WHITELIST = [
    'field_time',
    'bench_time',
    'total_distance',
    'total_duration',
    'total_player_load',
    'total_1d_side_player_load',
    'total_1d_up_player_load',
    'velocity_exertion',
    'max_vel',
    'peak_meta_power',
    'total_acceleration_load',
    'fmp_running_high_duration',
    'fmp_dynamic_high_duration',
    'gen2_velocity_band1_total_distance',
    'gen2_velocity_band2_total_distance',
    'gen2_velocity_band3_total_distance',
    'gen2_velocity_band4_total_distance',
    'gen2_velocity_band5_total_distance',
    'gen2_velocity_band5_total_effort_count',
    'metabolic_power_band5_total_distance',
    'ima_band3_accel_count',
    'ima_band3_right_count',
    'ima_band3_decel_count',
    'ima_band3_left_count',
    'rhie_bout_count',
    'rhie_max_effort_duration',
    'rhie_max_effort_count',
    'rhie_min_bout_recovery',
    'gen2_velocity_band_4_total_effort_count',
    'gen2_acceleration_band6plus_total_effort_count',
    'high_metabolic_load_distance',
    'meta_energy_kj',
    'work_rest_ratio',
];
export const CHATBOT_METRIC_WHITELIST_STATSPORTS = [
    'kpi_totalTime',
    'kpi_distanceTotal',
    'kpi_hmld',
    'kpi_energyExpenditure',
    'kpi_highSpeedRunningAbs',
    'kpi_sprintDistance',
    'kpi_sprints',
    'kpi_explosiveDistanceAbs',
    'kpi_hibsNumber',
    'kpi_accelerationsRel',
    'kpi_decelerationsRel',
    'kpi_dsl',
    'kpi_totalAccelLoading',
    'kpi_totalDecelLoading',
    'kpi_impactsRel',
    'kpi_distancePerMin',
    'kpi_hmldPerMin',
    'kpi_speedIntensity',
    'kpi_averageMetabolicPower',
    'kpi_maxSpeed',
    'kpi_maxAcceleration',
    'kpi_maxDeceleration',
    'kpi_accelerationsZ6Rel',
    'kpi_decelerationsZ6Rel',
    'kpi_totalLeftSteps',
    'kpi_totalRightSteps',
    'kpi_leftMagImpact',
    'kpi_rightMagImpact',
    'kpi_leftVerticalImpact',
    'kpi_rightVerticalImpact',
    'kpi_leftLateralImpact',
    'kpi_rightLateralImpact',
    'kpi_leftAntPostImpact',
    'kpi_rightAntPostImpact',
];
export function getChatbotMetricWhitelist(clubId) {
    if (!clubId)
        return null;
    if (usesStatsportsMetricWhitelist(clubId))
        return CHATBOT_METRIC_WHITELIST_STATSPORTS;
    if (isSunderlandClub(clubId))
        return CHATBOT_METRIC_WHITELIST;
    return null;
}
export const isChatbotAllowedPeriodMetric = (clubId, metricName) => {
    const whitelist = getChatbotMetricWhitelist(clubId);
    if (whitelist)
        return whitelist.includes(metricName);
    return !CHATBOT_FILTERED_PERIOD_METRICS.includes(metricName);
};
export const filterChatbotPeriodMetricNames = (clubId, names) => names.filter((name) => isChatbotAllowedPeriodMetric(clubId, name));
export const INSIGHT_FACTOR_CATAPULT_MAPPING = {
    TL_volume_F1: [
        'total_player_load',
        'total_1d_side_player_load',
        'total_1d_up_player_load',
        'field_time',
        'total_distance',
    ],
    TL_volume_F2: [
        'gen2_velocity_band2_total_distance',
        'field_time',
        'total_1d_up_player_load',
        'total_1d_side_player_load',
        'total_player_load',
    ],
    TL_HI_F1: [
        'velocity_exertion',
        'high_metabolic_load_distance',
        'gen2_velocity_band5_total_distance',
        'gen2_velocity_band3_total_distance',
        'gen2_velocity_band4_total_distance',
        'meta_energy_kj',
    ],
    TL_HI_F2: [
        'fmp_running_high_duration',
        'gen2_velocity_band5_total_distance',
        'gen2_velocity_band4_total_distance',
    ],
    TL_HI_F3: ['fmp_dynamic_high_duration', 'peak_meta_power', 'meta_energy_kj'],
    TL_NM_F1: [
        'total_acceleration_load',
        'gen2_acceleration_band6plus_total_effort_count',
        'rhie_bout_count',
        'ima_band3_accel_count',
    ],
    TL_NM_F2: [
        'ima_band3_left_count',
        'ima_band3_right_count',
        'ima_band3_decel_count',
        'rhie_max_effort_count',
        'ima_band3_accel_count',
    ],
};
//# sourceMappingURL=chatbot.constants.js.map