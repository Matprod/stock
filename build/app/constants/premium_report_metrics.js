import { filterChatbotPeriodMetricNames, isChatbotAllowedPeriodMetric, isSunderlandClub, usesStatsportsMetricWhitelist, } from '#constants/chatbot.constants';
export const GPS_DISTANCE_ALIASES = [
    'kpi_distanceTotal',
    'total_distance',
    'distance_total',
];
export const GPS_DURATION_ALIASES = [
    'kpi_totalTime',
    'total_time',
    'total_duration',
    'duration',
];
export const STATSPORTS_GPS_INTENSITY_KPIS = [
    { name: 'kpi_distanceTotal', alias: 'distance_m', agg: 'SUM', digits: 0 },
    { name: 'kpi_hmld', alias: 'hmld_m', agg: 'SUM', digits: 0 },
    { name: 'kpi_highSpeedRunningAbs', alias: 'hsr_m', agg: 'SUM', digits: 0 },
    { name: 'kpi_sprints', alias: 'sprints', agg: 'SUM', digits: 0 },
    { name: 'kpi_sprintDistance', alias: 'sprint_distance_m', agg: 'SUM', digits: 0 },
    { name: 'kpi_maxSpeed', alias: 'max_speed', agg: 'MAX', digits: 1 },
    { name: 'kpi_accelerationsRel', alias: 'accelerations', agg: 'SUM', digits: 0 },
    { name: 'kpi_decelerationsRel', alias: 'decelerations', agg: 'SUM', digits: 0 },
    { name: 'kpi_accelerationsZ6Rel', alias: 'accel_hi', agg: 'SUM', digits: 0 },
    { name: 'kpi_decelerationsZ6Rel', alias: 'decel_hi', agg: 'SUM', digits: 0 },
    { name: 'kpi_dsl', alias: 'dsl', agg: 'SUM', digits: 1 },
];
export const CATAPULT_GPS_INTENSITY_KPIS = [
    { name: 'total_distance', alias: 'distance_m', agg: 'SUM', digits: 0 },
    { name: 'high_metabolic_load_distance', alias: 'hmld_m', agg: 'SUM', digits: 0 },
    { name: 'gen2_velocity_band5_total_distance', alias: 'hsr_m', agg: 'SUM', digits: 0 },
    { name: 'gen2_velocity_band5_total_effort_count', alias: 'sprints', agg: 'SUM', digits: 0 },
    { name: 'max_vel', alias: 'max_speed', agg: 'MAX', digits: 1 },
    { name: 'ima_band3_accel_count', alias: 'accelerations', agg: 'SUM', digits: 0 },
    { name: 'ima_band3_decel_count', alias: 'decelerations', agg: 'SUM', digits: 0 },
    {
        name: 'gen2_acceleration_band6plus_total_effort_count',
        alias: 'accel_hi',
        agg: 'SUM',
        digits: 0,
    },
    { name: 'total_player_load', alias: 'dsl', agg: 'SUM', digits: 1 },
];
export const GPS_INTENSITY_KPIS = [
    ...STATSPORTS_GPS_INTENSITY_KPIS,
    { name: 'kpi_accelerationsZ4Z6Rel', alias: 'accel_hi', agg: 'SUM', digits: 0 },
    { name: 'kpi_decelerationsZ4Z6Rel', alias: 'decel_hi', agg: 'SUM', digits: 0 },
    { name: 'kpi_averageHeartRate', alias: 'avg_hr', agg: 'AVG', digits: 0 },
];
export const PLAYER_LOAD_SOURCE_METRICS = ['kpi_dsl', 'total_player_load', 'player_load'];
export const MATCH_STATS_KPIS = [
    { name: 'minutes_played', alias: 'minutes_total', agg: 'SUM', digits: 0 },
    { name: 'minutes_played', alias: 'minutes_moy', agg: 'AVG', digits: 0 },
    { name: 'total_distance', alias: 'distance_m', agg: 'SUM', digits: 0 },
    { name: 'sprint_distance', alias: 'sprint_distance_m', agg: 'SUM', digits: 0 },
    { name: 'intensive_run_distance', alias: 'intensive_run_m', agg: 'SUM', digits: 0 },
    { name: 'max_speed', alias: 'max_speed', agg: 'MAX', digits: 1 },
    { name: 'tackles_won', alias: 'tackles_won', agg: 'SUM', digits: 0 },
    { name: 'tackles_contested', alias: 'tackles_contested', agg: 'SUM', digits: 0 },
];
export const MATCH_STATS_METRIC_NAMES = [
    ...new Set(MATCH_STATS_KPIS.map((k) => k.name)),
];
export const GPS_DISTANCE_METRIC_NAMES = [
    ...GPS_DISTANCE_ALIASES,
    ...GPS_DURATION_ALIASES,
];
export const LOAD_SUMMARY_METRIC_COLUMNS = [
    'srpe_daily',
    'ewma_7',
    'ewma_28',
    'monotony',
    'strain',
    'acwr_ewma',
    'cumulative_7',
];
export const PREMIUM_SERIES_VALUE_COLUMNS = [
    'player_load',
    'dsl',
    ...LOAD_SUMMARY_METRIC_COLUMNS,
    'distance_m',
    'hmld_m',
    'hsr_m',
    'sprints',
    'sprint_distance_m',
    'max_speed',
    'accelerations',
    'decelerations',
    'accel_hi',
    'decel_hi',
    'avg_hr',
];
export const PREMIUM_ATHLETE_COLUMNS = [
    'joueur',
    'Joueur',
    'Player',
    'player',
    'name',
    'athlete',
    'Athlete',
    'Athlète',
    'full_name',
    'athlete_name',
];
const uniqueByAlias = (kpis) => {
    const seen = new Set();
    const out = [];
    for (const kpi of kpis) {
        if (seen.has(kpi.alias))
            continue;
        seen.add(kpi.alias);
        out.push(kpi);
    }
    return out;
};
const baseGpsIntensityCatalog = (clubId) => {
    if (usesStatsportsMetricWhitelist(clubId))
        return STATSPORTS_GPS_INTENSITY_KPIS;
    if (isSunderlandClub(clubId))
        return CATAPULT_GPS_INTENSITY_KPIS;
    return GPS_INTENSITY_KPIS;
};
export const gpsIntensityKpisForClub = (clubId) => {
    const allowed = baseGpsIntensityCatalog(clubId).filter((kpi) => isChatbotAllowedPeriodMetric(clubId, kpi.name));
    const picked = uniqueByAlias(allowed);
    return picked.length > 0 ? picked : uniqueByAlias(baseGpsIntensityCatalog(clubId));
};
export const playerLoadSourcesForClub = (clubId) => {
    const allowed = filterChatbotPeriodMetricNames(clubId, [...PLAYER_LOAD_SOURCE_METRICS]);
    return allowed.length > 0 ? allowed : [...PLAYER_LOAD_SOURCE_METRICS];
};
export const gpsDistanceAliasesForClub = (clubId) => {
    const allowed = filterChatbotPeriodMetricNames(clubId, [...GPS_DISTANCE_ALIASES]);
    return allowed.length > 0 ? allowed : [...GPS_DISTANCE_ALIASES];
};
export const gpsDurationAliasesForClub = (clubId) => {
    const allowed = filterChatbotPeriodMetricNames(clubId, [...GPS_DURATION_ALIASES]);
    return allowed.length > 0 ? allowed : [...GPS_DURATION_ALIASES];
};
export const gpsIntensityMetricNamesForClub = (clubId) => [
    ...new Set([
        ...gpsIntensityKpisForClub(clubId).map((k) => k.name),
        ...playerLoadSourcesForClub(clubId),
    ]),
];
export const pickPreferredSeriesColumn = (columns, preferred = PREMIUM_SERIES_VALUE_COLUMNS) => {
    const available = new Set(columns.map((column) => column.toLowerCase()));
    for (const name of preferred) {
        if (available.has(name.toLowerCase())) {
            return columns.find((column) => column.toLowerCase() === name.toLowerCase());
        }
    }
    return undefined;
};
export const pickAthleteColumn = (columns) => {
    for (const name of PREMIUM_ATHLETE_COLUMNS) {
        if (columns.includes(name))
            return name;
    }
    return undefined;
};
//# sourceMappingURL=premium_report_metrics.js.map