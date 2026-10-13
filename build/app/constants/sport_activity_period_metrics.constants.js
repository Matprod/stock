export const GPS_PERIOD_METRICS = [
    'distance_0_7_kmh',
    'distance_7_14_kmh',
    'distance_14_19_kmh',
    'distance_19_25_kmh',
    'distance_25_plus_kmh',
    'nb_efforts_above_19_8_kmh',
    'nb_efforts_above_25_kmh',
    'top_speed',
    'vmax_acceleration',
    'vmax_deceleration',
    'nb_decelerations_above_3ms2',
    'nb_accelerations_above_3ms2',
];
export const FIRSTBEAT_PERIOD_METRICS = [
    'energy_consumption_carbs',
    'energy_consumption_fats',
    'epoc_final',
    'epoc_peak',
    'hf_average',
    'lf_average',
    'lf_hf_ratio',
    'rmssd',
    'trimp',
    'movement_load',
    'zone1_time',
    'zone2_time',
    'zone3_time',
    'zone4_time',
    'zone5_time',
];
export const MILITARY_PERIOD_METRICS = ['carried_weight', 'weapon_weight', 'burst_count'];
export const SPORT_ACTIVITY_PERIOD_METRICS = [
    'strain',
    ...GPS_PERIOD_METRICS,
    ...FIRSTBEAT_PERIOD_METRICS,
    ...MILITARY_PERIOD_METRICS,
];
export const FIRSTBEAT_PERIOD_METRIC_BINDINGS = [
    ['energy_consumption_carbs', 'energyConsumptionCarbs'],
    ['energy_consumption_fats', 'energyConsumptionFats'],
    ['epoc_final', 'epocFinal'],
    ['epoc_peak', 'epocPeak'],
    ['hf_average', 'hfAverage'],
    ['lf_average', 'lfAverage'],
    ['lf_hf_ratio', 'lfHfRatio'],
    ['rmssd', 'rmssd'],
    ['trimp', 'trimp'],
    ['movement_load', 'movementLoad'],
    ['zone1_time', 'zone5Time'],
    ['zone2_time', 'zone4Time'],
    ['zone3_time', 'zone3Time'],
    ['zone4_time', 'zone2Time'],
    ['zone5_time', 'zone1Time'],
];
export const IMPUTATION_GPS_METRIC_BINDINGS = [
    ['Distance__0_7_km_h', 'distance_0_7_kmh'],
    ['Distance__7_15_km_h', 'distance_7_14_kmh'],
    ['Distance__15_20_km_h', 'distance_14_19_kmh'],
    ['Distance__20_25_km_h', 'distance_19_25_kmh'],
    ['Distance___25_km_h', 'distance_25_plus_kmh'],
    ['Nb_Efforts___15_km_h', 'nb_efforts_above_19_8_kmh'],
    ['Nb_Efforts___19_8_km_h', 'nb_efforts_above_19_8_kmh'],
    ['Nb_Efforts___25_km_h', 'nb_efforts_above_25_kmh'],
    ['Top_speed', 'top_speed'],
    ['Max_acceleration', 'vmax_acceleration'],
    ['Max_deceleration', 'vmax_deceleration'],
    ['Nb_dec___3_0m_s²', 'nb_decelerations_above_3ms2'],
    ['Nb_acc___3_0m_s²', 'nb_accelerations_above_3ms2'],
];
export const GPS_DISTANCE_BAND_LABELS = [
    { metric: 'distance_0_7_kmh', label: 'Distance Parcourue (à 0–7 km/h)' },
    { metric: 'distance_7_14_kmh', label: 'Distance Parcourue (à 7–15 km/h)' },
    { metric: 'distance_14_19_kmh', label: 'Distance Parcourue (à 15–20 km/h)' },
    { metric: 'distance_19_25_kmh', label: 'Distance Parcourue (à 20–25 km/h)' },
    { metric: 'distance_25_plus_kmh', label: 'Distance Parcourue (à >25 km/h)' },
];
export const RECOVERY_SCORE_PERIOD_METRICS = [
    'rmssd',
    'hf_average',
    'lf_hf_ratio',
    'epoc_final',
];
export const ZONE_TIME_PERIOD_METRICS = [
    'zone1_time',
    'zone2_time',
    'zone3_time',
    'zone4_time',
    'zone5_time',
];
//# sourceMappingURL=sport_activity_period_metrics.constants.js.map