import { MATCH_STATS_KPIS, MATCH_STATS_METRIC_NAMES, gpsDistanceAliasesForClub, gpsDurationAliasesForClub, gpsIntensityKpisForClub, gpsIntensityMetricNamesForClub, playerLoadSourcesForClub, } from '#constants/premium_report_metrics';
const JOUEUR = `TRIM(a.first_name) || ' ' || TRIM(a.last_name)`;
const athleteFilter = (athleteIds) => {
    if (!athleteIds?.length)
        return '';
    return ` AND a.id IN (${athleteIds.map((id) => `'${id}'`).join(',')})`;
};
const clubDateWhere = (args) => `a.club_id = '${args.clubId}'
  AND d.date_of_day BETWEEN '${args.from}' AND '${args.to}'
  ${athleteFilter(args.athleteIds)}`;
const entireSessionFilter = `
  AND (
    p.name ILIKE '%entire session%'
    OR NOT EXISTS (
      SELECT 1 FROM periods p2
      WHERE p2.sport_activity_id = p.sport_activity_id
        AND p2.name ILIKE '%entire session%'
    )
  )
`.trim();
const sqlInList = (names) => names.map((name) => `'${name}'`).join(',');
const caseAgg = (tableAlias, agg, name, as, digits) => {
    const valueAlias = tableAlias === 'pm' ? 'pmv' : 'samv';
    return `ROUND(${agg}(CASE WHEN ${tableAlias}.name = '${name}' THEN CAST(NULLIF(TRIM(${valueAlias}.value),'') AS DECIMAL) END), ${digits}) AS ${as}`;
};
const coalesceMax = (tableAlias, names) => {
    const valueAlias = tableAlias === 'pm' ? 'pmv' : 'samv';
    const parts = names.map((name) => `MAX(CASE WHEN ${tableAlias}.name = '${name}' THEN CAST(NULLIF(TRIM(${valueAlias}.value), '') AS DECIMAL) END)`);
    return `COALESCE(${parts.join(',\n      ')})`;
};
const coalesceSumAs = (tableAlias, names, as, digits) => {
    const valueAlias = tableAlias === 'pm' ? 'pmv' : 'samv';
    const parts = names.map((name) => `SUM(CASE WHEN ${tableAlias}.name = '${name}' THEN CAST(NULLIF(TRIM(${valueAlias}.value),'') AS DECIMAL) END)`);
    return `ROUND(COALESCE(${parts.join(', ')}), ${digits}) AS ${as}`;
};
export const sqlDailySrpe = (args) => `
WITH scoped_days AS (
  SELECT d.id
  FROM days d
  JOIN athletes a ON d.athlete_id = a.id
  WHERE ${clubDateWhere(args)}
),
day_minutes AS (
  SELECT sa.day_id, SUM(sa.duration_seconds / 60.0) AS minutes
  FROM sport_activities sa
  WHERE sa.day_id IN (SELECT id FROM scoped_days)
  GROUP BY sa.day_id
),
day_rpe AS (
  SELECT
    hr.day_id,
    MAX(CAST(hmv.value AS DECIMAL)) AS rpe,
    MAX(hm.unit) AS unit
  FROM health_ratings hr
  JOIN health_metric_values hmv ON hmv.health_id = hr.id
  JOIN health_metrics hm ON hm.id = hmv.metric_id
    AND (
      hm.name ILIKE 'training_rpe'
      OR hm.name ILIKE 'Training RPE'
      OR hm.name ILIKE '%training%rpe%'
    )
  WHERE hr.day_id IN (SELECT id FROM scoped_days)
  GROUP BY hr.day_id
)
SELECT
  d.date_of_day,
  ${JOUEUR} AS joueur,
  COALESCE(MAX(r.rpe) * MAX(m.minutes), 0) AS srpe_daily,
  MAX(r.unit) AS unit
FROM days d
JOIN athletes a ON d.athlete_id = a.id
LEFT JOIN day_minutes m ON m.day_id = d.id
LEFT JOIN day_rpe r ON r.day_id = d.id
WHERE ${clubDateWhere(args)}
GROUP BY d.date_of_day, a.id, a.first_name, a.last_name
ORDER BY joueur, d.date_of_day
`.trim();
export const sqlGpsDistance = (args) => {
    const distanceAliases = gpsDistanceAliasesForClub(args.clubId);
    const durationAliases = gpsDurationAliasesForClub(args.clubId);
    const metricNames = [...new Set([...distanceAliases, ...durationAliases])];
    return `
WITH period_stats AS (
  SELECT
    a.id AS athlete_id,
    ${JOUEUR} AS joueur,
    p.id AS period_id,
    sa.duration_seconds,
    ${coalesceMax('pm', distanceAliases)} AS distance_m,
    ${coalesceMax('pm', durationAliases)} AS duration_seconds_metric
  FROM athletes a
  JOIN days d ON d.athlete_id = a.id
  JOIN sport_activities sa ON sa.day_id = d.id
  JOIN periods p ON p.sport_activity_id = sa.id
  JOIN period_metric_values pmv ON pmv.period_id = p.id
  JOIN period_metrics pm ON pm.id = pmv.metric_id
    AND pm.name IN (${sqlInList(metricNames)})
  WHERE ${clubDateWhere(args)}
    ${entireSessionFilter}
  GROUP BY a.id, a.first_name, a.last_name, p.id, sa.duration_seconds
)
SELECT
  joueur,
  ROUND(SUM(distance_m), 0) AS total_distance_m,
  ROUND(SUM(COALESCE(duration_seconds_metric, CAST(duration_seconds AS DECIMAL), 0)) / 60.0, 1) AS total_minutes
FROM period_stats
WHERE distance_m IS NOT NULL
GROUP BY athlete_id, joueur
ORDER BY total_distance_m DESC NULLS LAST
`.trim();
};
export const sqlGpsIntensity = (args) => {
    const kpis = gpsIntensityKpisForClub(args.clubId);
    const loadSources = playerLoadSourcesForClub(args.clubId);
    const metricNames = gpsIntensityMetricNamesForClub(args.clubId);
    const orderCol = kpis.some((k) => k.alias === 'distance_m') ? 'distance_m' : 'player_load';
    return `
SELECT
  ${JOUEUR} AS joueur,
  ${kpis.map((k) => caseAgg('pm', k.agg, k.name, k.alias, k.digits)).join(',\n  ')},
  ${coalesceSumAs('pm', loadSources, 'player_load', 1)}
FROM athletes a
JOIN days d ON d.athlete_id = a.id
JOIN sport_activities sa ON sa.day_id = d.id
JOIN periods p ON p.sport_activity_id = sa.id
JOIN period_metric_values pmv ON pmv.period_id = p.id
JOIN period_metrics pm ON pm.id = pmv.metric_id
  AND pm.name IN (${sqlInList(metricNames)})
WHERE ${clubDateWhere(args)}
  ${entireSessionFilter}
GROUP BY a.id, a.first_name, a.last_name
ORDER BY ${orderCol} DESC NULLS LAST
`.trim();
};
export const sqlGpsIntensityDaily = (args) => {
    const kpis = gpsIntensityKpisForClub(args.clubId);
    const loadSources = playerLoadSourcesForClub(args.clubId);
    const metricNames = gpsIntensityMetricNamesForClub(args.clubId);
    const orderMetric = kpis.find((k) => k.alias === 'accel_hi')?.alias ??
        kpis.find((k) => k.alias === 'distance_m')?.alias ??
        'player_load';
    return `
SELECT
  d.date_of_day,
  ${JOUEUR} AS joueur,
  ${kpis.map((k) => caseAgg('pm', k.agg, k.name, k.alias, k.digits)).join(',\n  ')},
  ${coalesceSumAs('pm', loadSources, 'player_load', 1)}
FROM athletes a
JOIN days d ON d.athlete_id = a.id
JOIN sport_activities sa ON sa.day_id = d.id
JOIN periods p ON p.sport_activity_id = sa.id
JOIN period_metric_values pmv ON pmv.period_id = p.id
JOIN period_metrics pm ON pm.id = pmv.metric_id
  AND pm.name IN (${sqlInList(metricNames)})
WHERE ${clubDateWhere(args)}
  AND sa.game_activity IS NOT TRUE
  ${entireSessionFilter}
GROUP BY d.date_of_day, a.id, a.first_name, a.last_name
ORDER BY d.date_of_day, ${orderMetric} DESC NULLS LAST
`.trim();
};
export const sqlBiomarkers = (args) => `
SELECT
  ${JOUEUR} AS joueur,
  bt.name AS biomarqueur,
  ROUND(AVG(CAST(NULLIF(TRIM(b.value), '') AS DECIMAL)), 2) AS valeur,
  COUNT(*) AS nb_mesures,
  MAX(bt.unit) AS unit
FROM biomarkers b
JOIN biomarker_types bt ON bt.id = b.biomarker_type_id
JOIN biomarker_type_clubs btc ON btc.biomarker_type_id = bt.id AND btc.club_id = '${args.clubId}'
JOIN athletes a ON a.id = b.athlete_id
WHERE a.club_id = '${args.clubId}'
  AND (b.measured_at AT TIME ZONE 'UTC')::date BETWEEN '${args.from}' AND '${args.to}'
  ${athleteFilter(args.athleteIds)}
GROUP BY a.id, a.first_name, a.last_name, bt.name
HAVING AVG(CAST(NULLIF(TRIM(b.value), '') AS DECIMAL)) IS NOT NULL
ORDER BY bt.name, valeur DESC NULLS LAST
`.trim();
export const sqlValdTests = (args) => `
SELECT
  ${JOUEUR} AS joueur,
  vt.test_type,
  ROUND(AVG(vtr.trial_jump_height)::NUMERIC, 2) AS jump_height_moy,
  ROUND(MAX(vtr.trial_jump_height)::NUMERIC, 2) AS jump_height_max,
  ROUND(AVG(vtr.trial_rsi)::NUMERIC, 3) AS rsi_moy,
  ROUND(AVG(vtr.trial_rsi_modified)::NUMERIC, 3) AS rsi_mod_moy,
  ROUND(AVG(vtr.trial_peak_takeoff_power)::NUMERIC, 1) AS peak_power_moy,
  ROUND(AVG(vtr.trial_concentric_rfd)::NUMERIC, 1) AS concentric_rfd_moy,
  ROUND(AVG(vtr.trial_peak_landing_force)::NUMERIC, 1) AS landing_force_moy,
  ROUND(AVG(vtr.trial_eccentric_braking_rfd)::NUMERIC, 1) AS eccentric_rfd_moy,
  COUNT(vtr.id) AS nb_trials,
  COUNT(DISTINCT vt.id) AS nb_tests
FROM vald_trials vtr
JOIN vald_tests vt ON vt.id = vtr.vald_test_id
JOIN days d ON d.id = vt.day_id
JOIN athletes a ON a.id = d.athlete_id
WHERE ${clubDateWhere(args)}
GROUP BY a.id, a.first_name, a.last_name, vt.test_type
HAVING COUNT(vtr.id) > 0
ORDER BY vt.test_type, jump_height_moy DESC NULLS LAST
`.trim();
export const sqlBodyMetrics = (args) => `
WITH ranked AS (
  SELECT
    ${JOUEUR} AS joueur,
    d.date_of_day,
    ROUND(bh.weight::NUMERIC, 1) AS poids_kg,
    ROUND(bh.fat_percentage::NUMERIC, 1) AS masse_grasse_pct,
    ROW_NUMBER() OVER (PARTITION BY a.id ORDER BY d.date_of_day DESC) AS rn
  FROM bodymetrics_histories bh
  JOIN athletes a ON a.id = bh.athlete_id
  JOIN days d ON d.id = bh.day_id
  WHERE ${clubDateWhere(args)}
    AND (bh.weight IS NOT NULL OR bh.fat_percentage IS NOT NULL)
)
SELECT joueur, date_of_day, poids_kg, masse_grasse_pct
FROM ranked
WHERE rn = 1
ORDER BY poids_kg DESC NULLS LAST
`.trim();
export const sqlMatchStats = (args) => `
SELECT
  ${JOUEUR} AS joueur,
  COUNT(DISTINCT sa.id) AS nb_matchs,
  ${MATCH_STATS_KPIS.map((k) => caseAgg('sam', k.agg, k.name, k.alias, k.digits)).join(',\n  ')}
FROM athletes a
JOIN days d ON d.athlete_id = a.id
JOIN sport_activities sa ON sa.day_id = d.id AND sa.game_activity = true
JOIN sport_activity_metric_values samv ON samv.sport_activity_id = sa.id
JOIN sport_activity_metrics sam ON sam.id = samv.metric_id
  AND sam.name IN (${sqlInList(MATCH_STATS_METRIC_NAMES)})
WHERE ${clubDateWhere(args)}
GROUP BY a.id, a.first_name, a.last_name
HAVING COUNT(DISTINCT sa.id) > 0
ORDER BY minutes_total DESC NULLS LAST
`.trim();
export const PREMIUM_SQL_TEMPLATE = {
    DAILY_SRPE: 'daily_srpe',
    GPS_DISTANCE: 'gps_distance',
    GPS_INTENSITY: 'gps_intensity',
    GPS_INTENSITY_DAILY: 'gps_intensity_daily',
    MATCH_STATS: 'match_stats',
    BIOMARKERS: 'biomarkers',
    VALD_TESTS: 'vald_tests',
    BODY_METRICS: 'body_metrics',
};
export const buildPremiumSqlTemplate = (id, args) => {
    const builders = {
        [PREMIUM_SQL_TEMPLATE.DAILY_SRPE]: sqlDailySrpe,
        [PREMIUM_SQL_TEMPLATE.GPS_DISTANCE]: sqlGpsDistance,
        [PREMIUM_SQL_TEMPLATE.GPS_INTENSITY]: sqlGpsIntensity,
        [PREMIUM_SQL_TEMPLATE.GPS_INTENSITY_DAILY]: sqlGpsIntensityDaily,
        [PREMIUM_SQL_TEMPLATE.MATCH_STATS]: sqlMatchStats,
        [PREMIUM_SQL_TEMPLATE.BIOMARKERS]: sqlBiomarkers,
        [PREMIUM_SQL_TEMPLATE.VALD_TESTS]: sqlValdTests,
        [PREMIUM_SQL_TEMPLATE.BODY_METRICS]: sqlBodyMetrics,
    };
    return builders[id](args);
};
//# sourceMappingURL=premium_report_sql_templates.js.map