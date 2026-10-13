import { pickGpsOrderColumn } from '#constants/premium_report_metrics'
import {
  clubMetricCatalog,
  selectMatchKpis,
  selectPeriodKpis,
} from '#services/premium_report/club_metric_catalog'
import { probeRpeSources, RPE_SOURCE } from '#services/premium_report/rpe_source_probe'

export type PremiumSqlTemplateArgs = {
  clubId: string
  from: string
  to: string
  athleteIds?: string[]
  testTypes?: string[]
  preferredPeriodNames?: string[]
  preferredMatchNames?: string[]
  preferredMatchSource?: string
}

const JOUEUR = `TRIM(a.first_name) || ' ' || TRIM(a.last_name)`

const athleteFilter = (athleteIds?: string[]): string => {
  if (!athleteIds?.length) return ''
  return ` AND a.id IN (${athleteIds.map((id) => `'${id}'`).join(',')})`
}

const sqlColumnLikeAny = (column: string, values: string[] | undefined): string => {
  if (!values?.length) return ''
  const clauses = values.map((value) => {
    const escaped = value.replace(/'/g, "''").toUpperCase()
    return `UPPER(TRIM(${column})) LIKE '%${escaped}%'`
  })
  return ` AND (${clauses.join(' OR ')})`
}

const clubDateWhere = (args: PremiumSqlTemplateArgs): string =>
  `a.club_id = '${args.clubId}'
  AND d.date_of_day BETWEEN '${args.from}' AND '${args.to}'
  ${athleteFilter(args.athleteIds)}`

const SESSION_TOTAL_NAME_SQL = `
  p2.name ILIKE '%entire session%'
  OR p2.name ILIKE '%full session%'
  OR p2.name ILIKE '%whole session%'
`.trim()

const entireSessionFilter = (): string =>
  `
  AND (
    p.name ILIKE '%entire session%'
    OR p.name ILIKE '%full session%'
    OR p.name ILIKE '%whole session%'
    OR NOT EXISTS (
      SELECT 1 FROM periods p2
      WHERE p2.sport_activity_id = p.sport_activity_id
        AND (${SESSION_TOTAL_NAME_SQL})
    )
  )`.trimEnd()

const sqlInList = (names: readonly string[]): string => {
  if (names.length === 0) return 'NULL'
  return names.map((name) => `'${name.replace(/'/g, "''")}'`).join(',')
}

export const sqlSafeDecimalCast = (valueExpr: string): string =>
  `CASE WHEN NULLIF(TRIM(${valueExpr}), '') ~ '^-{0,1}[0-9]+(\\.[0-9]+){0,1}$' THEN CAST(TRIM(${valueExpr}) AS DECIMAL) END`

const caseAgg = (
  tableAlias: 'pm' | 'sam',
  agg: 'SUM' | 'MAX' | 'AVG',
  name: string,
  as: string,
  digits: number
): string => {
  const valueAlias = tableAlias === 'pm' ? 'pmv' : 'samv'
  const safeName = name.replace(/'/g, "''")
  const safeAlias = as.replace(/[^a-zA-Z0-9_]/g, '_')
  return `ROUND(${agg}(CASE WHEN ${tableAlias}.name = '${safeName}' THEN ${sqlSafeDecimalCast(`${valueAlias}.value`)} END), ${digits}) AS ${safeAlias}`
}

const coalesceMax = (tableAlias: 'pm' | 'sam', names: readonly string[]): string => {
  if (names.length === 0) return 'NULL'
  const valueAlias = tableAlias === 'pm' ? 'pmv' : 'samv'
  const parts = names.map(
    (name) =>
      `MAX(CASE WHEN ${tableAlias}.name = '${name.replace(/'/g, "''")}' THEN ${sqlSafeDecimalCast(`${valueAlias}.value`)} END)`
  )
  return `COALESCE(${parts.join(',\n      ')})`
}

const DEFAULT_HEALTH_RPE_NAMES = [
  'training_rpe',
  'post_training_rpe',
  'pre_training_rpe',
  'session_rpe',
  'rpe',
]

export const sqlDailySrpe = async (args: PremiumSqlTemplateArgs): Promise<string> => {
  const [catalog, rpeProbe] = await Promise.all([
    clubMetricCatalog(args.clubId, { from: args.from, to: args.to }),
    probeRpeSources({
      clubId: args.clubId,
      to: args.to,
      athleteIds: args.athleteIds,
    }),
  ])
  const healthHit =
    rpeProbe.sources.find((s) => s.source === RPE_SOURCE.HEALTH_METRICS)?.populated ?? false
  const sportHit =
    rpeProbe.sources.find((s) => s.source === RPE_SOURCE.SPORT_ACTIVITIES)?.populated ?? false
  const useHealthMetrics = healthHit || !sportHit
  const useSportActivities = !healthHit
  const rpeFilter = catalog.rpeNames.length > 0 ? catalog.rpeNames : DEFAULT_HEALTH_RPE_NAMES
  const durationAliases = catalog.namesByUnit('duration')
  const dayPeriodMinutesCte =
    durationAliases.length > 0
      ? `,
day_period_minutes AS (
  SELECT
    sa.day_id,
    SUM(${sqlSafeDecimalCast('pmv.value')}) / 60.0 AS minutes
  FROM sport_activities sa
  JOIN periods p ON p.sport_activity_id = sa.id
  JOIN period_metric_values pmv ON pmv.period_id = p.id
  JOIN period_metrics pm ON pm.id = pmv.metric_id
    AND pm.name IN (${sqlInList(durationAliases)})
  WHERE sa.day_id IN (SELECT id FROM scoped_days)
  ${entireSessionFilter()}
  GROUP BY sa.day_id
)`
      : ''
  const periodJoin =
    durationAliases.length > 0 ? 'LEFT JOIN day_period_minutes per ON per.day_id = d.id' : ''
  const minutesExpr =
    durationAliases.length > 0
      ? 'COALESCE(NULLIF(act.minutes, 0), NULLIF(per.minutes, 0), 0)'
      : 'COALESCE(act.minutes, 0)'

  const healthCte = useHealthMetrics
    ? `,
day_health_rpe AS (
  SELECT
    hr.day_id,
    MAX(${sqlSafeDecimalCast('hmv.value')}) AS rpe,
    MAX(hm.unit) AS unit
  FROM health_ratings hr
  JOIN health_metric_values hmv ON hmv.health_id = hr.id
  JOIN health_metrics hm ON hm.id = hmv.metric_id
    AND (
      hm.name IN (${sqlInList(rpeFilter)})
      OR LOWER(hm.name) LIKE '%rpe%'
      OR LOWER(hm.name) LIKE '%exertion%'
      OR LOWER(hm.name) LIKE '%borg%'
      OR LOWER(REPLACE(hm.name, ' ', '_')) LIKE '%effort%'
    )
  WHERE hr.day_id IN (SELECT id FROM scoped_days)
  GROUP BY hr.day_id
)`
    : ''

  const activityRpeExpr = useSportActivities
    ? `SUM(
      CASE
        WHEN NULLIF(sa.rpe, 0) IS NOT NULL AND COALESCE(sa.duration_seconds, 0) > 0
          THEN sa.rpe::numeric * (sa.duration_seconds / 60.0)
        ELSE NULL
      END
    ) AS srpe_sa,
    MAX(NULLIF(sa.rpe, 0)::numeric) AS max_sa_rpe`
    : `NULL::numeric AS srpe_sa,
    NULL::numeric AS max_sa_rpe`

  const healthJoin = useHealthMetrics ? 'LEFT JOIN day_health_rpe hrpe ON hrpe.day_id = d.id' : ''
  const healthRpeExpr = useHealthMetrics ? 'hrpe.rpe' : 'NULL::numeric'
  const healthUnitExpr = useHealthMetrics ? 'hrpe.unit' : 'NULL::text'

  const srpeCoalesce =
    useSportActivities || useHealthMetrics
      ? `COALESCE(
      NULLIF(act.srpe_sa, 0),
      NULLIF(
        COALESCE(${healthRpeExpr}, act.max_sa_rpe) * NULLIF(${minutesExpr}, 0),
        0
      ),
      0
    )`
      : '0'

  return `
WITH scoped_days AS (
  SELECT d.id
  FROM days d
  JOIN athletes a ON d.athlete_id = a.id
  WHERE ${clubDateWhere(args)}
)${healthCte},
day_activity AS (
  SELECT
    sa.day_id,
    SUM(COALESCE(sa.duration_seconds, 0) / 60.0) AS minutes,
    ${activityRpeExpr}
  FROM sport_activities sa
  WHERE sa.day_id IN (SELECT id FROM scoped_days)
  GROUP BY sa.day_id
)${dayPeriodMinutesCte}
SELECT
  d.date_of_day,
  ${JOUEUR} AS joueur,
  ROUND(${srpeCoalesce}, 1) AS srpe_daily,
  ${healthUnitExpr} AS unit
FROM days d
JOIN athletes a ON d.athlete_id = a.id
LEFT JOIN day_activity act ON act.day_id = d.id
${healthJoin}
${periodJoin}
WHERE ${clubDateWhere(args)}
ORDER BY joueur, d.date_of_day
`.trim()
}

export const sqlGpsDistance = async (args: PremiumSqlTemplateArgs): Promise<string> => {
  const catalog = await clubMetricCatalog(args.clubId, { from: args.from, to: args.to })
  const distanceAliases = catalog.namesByUnit('distance')
  const durationAliases = catalog.namesByUnit('duration')
  const metricNames = [...new Set([...distanceAliases, ...durationAliases])]
  if (metricNames.length === 0) {
    return `
SELECT
  ${JOUEUR} AS joueur,
  NULL::numeric AS total_distance_m,
  ROUND(SUM(COALESCE(CAST(sa.duration_seconds AS DECIMAL), 0)) / 60.0, 1) AS total_minutes
FROM athletes a
JOIN days d ON d.athlete_id = a.id
JOIN sport_activities sa ON sa.day_id = d.id
WHERE ${clubDateWhere(args)}
GROUP BY a.id, a.first_name, a.last_name
ORDER BY total_minutes DESC NULLS LAST
`.trim()
  }
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
    ${entireSessionFilter()}
  GROUP BY a.id, a.first_name, a.last_name, p.id, sa.duration_seconds
)
SELECT
  joueur,
  ROUND(SUM(distance_m), 0) AS total_distance_m,
  ROUND(SUM(COALESCE(duration_seconds_metric, CAST(duration_seconds AS DECIMAL), 0)) / 60.0, 1) AS total_minutes
FROM period_stats
WHERE distance_m IS NOT NULL OR duration_seconds IS NOT NULL
GROUP BY athlete_id, joueur
ORDER BY total_distance_m DESC NULLS LAST
`.trim()
}

export const sqlGpsIntensity = async (args: PremiumSqlTemplateArgs): Promise<string> => {
  const catalog = await clubMetricCatalog(args.clubId, { from: args.from, to: args.to })
  const kpis = selectPeriodKpis(catalog, args.preferredPeriodNames ?? [])
  const metricNames = kpis.map((k) => k.name)
  const orderCol = pickGpsOrderColumn(kpis.map((k) => k.alias))
  const kpiSelect = kpis.map((k) => caseAgg('pm', k.agg, k.name, k.alias, k.digits)).join(',\n  ')
  return `
SELECT
  ${JOUEUR} AS joueur${kpiSelect ? `,\n  ${kpiSelect}` : ''}
FROM athletes a
JOIN days d ON d.athlete_id = a.id
JOIN sport_activities sa ON sa.day_id = d.id
JOIN periods p ON p.sport_activity_id = sa.id
JOIN period_metric_values pmv ON pmv.period_id = p.id
JOIN period_metrics pm ON pm.id = pmv.metric_id
  AND pm.name IN (${sqlInList(metricNames.length > 0 ? metricNames : ['__none__'])})
WHERE ${clubDateWhere(args)}
  ${entireSessionFilter()}
GROUP BY a.id, a.first_name, a.last_name
ORDER BY ${orderCol} DESC NULLS LAST
`.trim()
}

export const sqlGpsIntensityDaily = async (args: PremiumSqlTemplateArgs): Promise<string> => {
  const catalog = await clubMetricCatalog(args.clubId, { from: args.from, to: args.to })
  const kpis = selectPeriodKpis(catalog, args.preferredPeriodNames ?? [])
  const metricNames = kpis.map((k) => k.name)
  const orderMetric = pickGpsOrderColumn(kpis.map((k) => k.alias))
  const kpiSelect = kpis.map((k) => caseAgg('pm', k.agg, k.name, k.alias, k.digits)).join(',\n  ')
  return `
SELECT
  d.date_of_day,
  ${JOUEUR} AS joueur${kpiSelect ? `,\n  ${kpiSelect}` : ''}
FROM athletes a
JOIN days d ON d.athlete_id = a.id
JOIN sport_activities sa ON sa.day_id = d.id
JOIN periods p ON p.sport_activity_id = sa.id
JOIN period_metric_values pmv ON pmv.period_id = p.id
JOIN period_metrics pm ON pm.id = pmv.metric_id
  AND pm.name IN (${sqlInList(metricNames.length > 0 ? metricNames : ['__none__'])})
WHERE ${clubDateWhere(args)}
  AND sa.game_activity IS NOT TRUE
  ${entireSessionFilter()}
GROUP BY d.date_of_day, a.id, a.first_name, a.last_name
ORDER BY d.date_of_day, ${orderMetric} DESC NULLS LAST
`.trim()
}

const matchSourceFilter = (args: PremiumSqlTemplateArgs): string => {
  const source = args.preferredMatchSource?.trim().toLowerCase()
  if (!source) return ''
  const escaped = source.replace(/'/g, "''")
  return ` AND LOWER(TRIM(samv.source)) = '${escaped}'`
}

const resolveMatchKpis = async (args: PremiumSqlTemplateArgs) => {
  const catalog = await clubMetricCatalog(args.clubId, { from: args.from, to: args.to })
  const kpis = selectMatchKpis(catalog, args.preferredMatchNames ?? [])
  return { catalog, kpis, metricNames: kpis.map((k) => k.name) }
}

const matchStatsJoins = (metricNames: string[]): string => {
  if (metricNames.length === 0) {
    return `
JOIN sport_activities sa ON sa.day_id = d.id AND sa.game_activity = true`
  }
  return `
JOIN sport_activities sa ON sa.day_id = d.id AND sa.game_activity = true
LEFT JOIN sport_activity_metric_values samv ON samv.sport_activity_id = sa.id
LEFT JOIN sport_activity_metrics sam ON sam.id = samv.metric_id
  AND sam.name IN (${sqlInList(metricNames)})`
}

const matchMinutesSelect = (metricNames: string[]): string =>
  metricNames.length === 0
    ? `,\n  ROUND(SUM(COALESCE(sa.duration_seconds, 0)) / 60.0, 1) AS minutes_played`
    : ''

export const sqlMatchStats = async (args: PremiumSqlTemplateArgs): Promise<string> => {
  const { kpis, metricNames } = await resolveMatchKpis(args)
  const orderCol = pickGpsOrderColumn(kpis.map((k) => k.alias)) || 'nb_matchs'
  const kpiSelect = kpis.map((k) => caseAgg('sam', k.agg, k.name, k.alias, k.digits)).join(',\n  ')
  const sourceFilter = metricNames.length > 0 ? matchSourceFilter(args) : ''
  return `
SELECT
  ${JOUEUR} AS joueur,
  COUNT(DISTINCT sa.id) AS nb_matchs${matchMinutesSelect(metricNames)}${kpiSelect ? `,\n  ${kpiSelect}` : ''}
FROM athletes a
JOIN days d ON d.athlete_id = a.id${matchStatsJoins(metricNames)}
WHERE ${clubDateWhere(args)}
  ${sourceFilter}
GROUP BY a.id, a.first_name, a.last_name
HAVING COUNT(DISTINCT sa.id) > 0
ORDER BY ${orderCol} DESC NULLS LAST
`.trim()
}

export const sqlMatchStatsDaily = async (args: PremiumSqlTemplateArgs): Promise<string> => {
  const { kpis, metricNames } = await resolveMatchKpis(args)
  const orderCol = pickGpsOrderColumn(kpis.map((k) => k.alias)) || 'nb_matchs'
  const kpiSelect = kpis.map((k) => caseAgg('sam', k.agg, k.name, k.alias, k.digits)).join(',\n  ')
  const sourceFilter = metricNames.length > 0 ? matchSourceFilter(args) : ''
  return `
SELECT
  d.date_of_day,
  ${JOUEUR} AS joueur,
  COUNT(DISTINCT sa.id) AS nb_matchs${matchMinutesSelect(metricNames)}${kpiSelect ? `,\n  ${kpiSelect}` : ''}
FROM athletes a
JOIN days d ON d.athlete_id = a.id${matchStatsJoins(metricNames)}
WHERE ${clubDateWhere(args)}
  ${sourceFilter}
GROUP BY d.date_of_day, a.id, a.first_name, a.last_name
HAVING COUNT(DISTINCT sa.id) > 0
ORDER BY d.date_of_day, ${orderCol} DESC NULLS LAST
`.trim()
}

const biomarkerTypeClubScope = (clubId: string): string =>
  `
  (
    NOT EXISTS (
      SELECT 1 FROM biomarker_type_clubs scoped
      WHERE scoped.biomarker_type_id = bt.id
    )
    OR EXISTS (
      SELECT 1 FROM biomarker_type_clubs scoped
      WHERE scoped.biomarker_type_id = bt.id AND scoped.club_id = '${clubId}'
    )
  )
`.trim()

export const sqlBiomarkers = (args: PremiumSqlTemplateArgs): string =>
  `
SELECT
  ${JOUEUR} AS joueur,
  bt.name AS biomarqueur,
  ROUND(AVG(${sqlSafeDecimalCast('b.value')}), 2) AS valeur,
  COUNT(*) AS nb_mesures,
  MAX(bt.unit) AS unit
FROM biomarkers b
JOIN biomarker_types bt ON bt.id = b.biomarker_type_id
JOIN athletes a ON a.id = b.athlete_id
WHERE a.club_id = '${args.clubId}'
  AND ${biomarkerTypeClubScope(args.clubId)}
  AND (b.measured_at AT TIME ZONE 'UTC')::date BETWEEN '${args.from}' AND '${args.to}'
  ${athleteFilter(args.athleteIds)}
GROUP BY a.id, a.first_name, a.last_name, bt.name
HAVING AVG(${sqlSafeDecimalCast('b.value')}) IS NOT NULL
ORDER BY bt.name, valeur DESC NULLS LAST
`.trim()

export const sqlBiomarkersDaily = (args: PremiumSqlTemplateArgs): string =>
  `
SELECT
  ${JOUEUR} AS joueur,
  (b.measured_at AT TIME ZONE 'UTC')::date AS date_of_day,
  bt.name AS biomarqueur,
  ROUND(AVG(${sqlSafeDecimalCast('b.value')}), 2) AS valeur,
  MAX(bt.unit) AS unit,
  COUNT(*) AS nb_mesures
FROM biomarkers b
JOIN biomarker_types bt ON bt.id = b.biomarker_type_id
JOIN athletes a ON a.id = b.athlete_id
WHERE a.club_id = '${args.clubId}'
  AND ${biomarkerTypeClubScope(args.clubId)}
  AND (b.measured_at AT TIME ZONE 'UTC')::date BETWEEN '${args.from}' AND '${args.to}'
  ${athleteFilter(args.athleteIds)}
GROUP BY a.id, a.first_name, a.last_name, (b.measured_at AT TIME ZONE 'UTC')::date, bt.name
HAVING AVG(${sqlSafeDecimalCast('b.value')}) IS NOT NULL
ORDER BY date_of_day, bt.name, joueur
`.trim()

export const sqlDailyScores = (args: PremiumSqlTemplateArgs): string =>
  `
SELECT
  ${JOUEUR} AS joueur,
  d.date_of_day,
  ROUND(d.performance_score::NUMERIC, 1) AS performance_score,
  ROUND(d.injury_risk_score::NUMERIC, 1) AS injury_risk_score
FROM days d
JOIN athletes a ON a.id = d.athlete_id
WHERE ${clubDateWhere(args)}
  AND (d.performance_score IS NOT NULL OR d.injury_risk_score IS NOT NULL)
ORDER BY d.date_of_day, joueur
`.trim()

export const sqlValdTests = (args: PremiumSqlTemplateArgs): string =>
  `
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
WHERE ${clubDateWhere(args)}${sqlColumnLikeAny('vt.test_type', args.testTypes)}
GROUP BY a.id, a.first_name, a.last_name, vt.test_type
HAVING COUNT(vtr.id) > 0
ORDER BY vt.test_type, jump_height_moy DESC NULLS LAST
`.trim()

export const sqlBodyMetrics = (args: PremiumSqlTemplateArgs): string =>
  `
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
`.trim()

export const sqlInjuries = (args: PremiumSqlTemplateArgs): string =>
  `
SELECT
  ${JOUEUR} AS joueur,
  i.date_of_injury::date AS date_of_injury,
  i.recovery_date::date AS recovery_date,
  CASE WHEN i.recovery_date IS NULL THEN 'ongoing' ELSE 'recovered' END AS status,
  COALESCE(
    NULLIF(TRIM(i.pathology), ''),
    NULLIF(TRIM(t_type.value), ''),
    NULLIF(TRIM(it.name), ''),
    'Injury'
  ) AS injury,
  COALESCE(NULLIF(TRIM(t_section.value), ''), '') AS location,
  i.context::text AS context,
  i.contact_type::text AS contact_type,
  i.tissue AS tissue,
  i.mechanism AS mechanism
FROM injuries i
JOIN athletes a ON a.id = i.athlete_id
LEFT JOIN injury_types it ON it.id = i.type_of_injury_id
LEFT JOIN injury_sections sec ON sec.id = it.category_id
LEFT JOIN translations t_type
  ON t_type.translatable_id = it.id
  AND t_type.translatable_type = 'injury_type'
  AND t_type.key = 'injury_type_name'
  AND t_type.language = 'en'
LEFT JOIN translations t_section
  ON t_section.translatable_id = sec.id
  AND t_section.translatable_type = 'injury_section'
  AND t_section.key = 'injury_section_name'
  AND t_section.language = 'en'
WHERE a.club_id = '${args.clubId}'
  ${athleteFilter(args.athleteIds)}
  AND i.date_of_injury IS NOT NULL
  AND i.date_of_injury <= '${args.to}'
  AND (i.recovery_date IS NULL OR i.recovery_date >= '${args.from}')
ORDER BY i.date_of_injury DESC NULLS LAST, joueur
`.trim()

export const PREMIUM_SQL_TEMPLATE = {
  DAILY_SRPE: 'daily_srpe',
  GPS_DISTANCE: 'gps_distance',
  GPS_INTENSITY: 'gps_intensity',
  GPS_INTENSITY_DAILY: 'gps_intensity_daily',
  MATCH_STATS: 'match_stats',
  MATCH_STATS_DAILY: 'match_stats_daily',
  BIOMARKERS: 'biomarkers',
  BIOMARKERS_DAILY: 'biomarkers_daily',
  VALD_TESTS: 'vald_tests',
  BODY_METRICS: 'body_metrics',
  DAILY_SCORES: 'daily_scores',
  INJURIES: 'injuries',
} as const

export type PremiumSqlTemplateId = (typeof PREMIUM_SQL_TEMPLATE)[keyof typeof PREMIUM_SQL_TEMPLATE]

export const buildPremiumSqlTemplate = async (
  id: PremiumSqlTemplateId,
  args: PremiumSqlTemplateArgs
): Promise<string> => {
  const builders: Record<
    PremiumSqlTemplateId,
    (a: PremiumSqlTemplateArgs) => string | Promise<string>
  > = {
    [PREMIUM_SQL_TEMPLATE.DAILY_SRPE]: sqlDailySrpe,
    [PREMIUM_SQL_TEMPLATE.GPS_DISTANCE]: sqlGpsDistance,
    [PREMIUM_SQL_TEMPLATE.GPS_INTENSITY]: sqlGpsIntensity,
    [PREMIUM_SQL_TEMPLATE.GPS_INTENSITY_DAILY]: sqlGpsIntensityDaily,
    [PREMIUM_SQL_TEMPLATE.MATCH_STATS]: sqlMatchStats,
    [PREMIUM_SQL_TEMPLATE.MATCH_STATS_DAILY]: sqlMatchStatsDaily,
    [PREMIUM_SQL_TEMPLATE.BIOMARKERS]: sqlBiomarkers,
    [PREMIUM_SQL_TEMPLATE.BIOMARKERS_DAILY]: sqlBiomarkersDaily,
    [PREMIUM_SQL_TEMPLATE.VALD_TESTS]: sqlValdTests,
    [PREMIUM_SQL_TEMPLATE.BODY_METRICS]: sqlBodyMetrics,
    [PREMIUM_SQL_TEMPLATE.DAILY_SCORES]: sqlDailyScores,
    [PREMIUM_SQL_TEMPLATE.INJURIES]: sqlInjuries,
  }
  return builders[id](args)
}
