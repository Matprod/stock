import db from '@adonisjs/lucid/services/db'
import { shiftIsoDate, type IsoDateRange } from '#services/report_v4/lookback_range'

const RPE_PROBE_LOOKBACK_DAYS = 14

export const RPE_SOURCE = {
  HEALTH_METRICS: 'health_metrics',
  SPORT_ACTIVITIES: 'sport_activities',
  HEALTH_RATINGS: 'health_ratings',
} as const

type RpeSourceId = (typeof RPE_SOURCE)[keyof typeof RPE_SOURCE]

type RpeSourceHit = {
  source: RpeSourceId
  table: string
  fetchVia: string
  role: 'session_rpe' | 'body_rpe'
  daysWithData: number
  athletesWithData: number
  metricNames: string[]
  populated: boolean
}

type RpeSourceProbe = {
  lookback: IsoDateRange
  sources: RpeSourceHit[]
  sessionPrimary: RpeSourceHit | null
  bodyPrimary: RpeSourceHit | null
  fetchTable: string | null
}

const HEALTH_RPE_NAME_SQL = `
  LOWER(hm.name) LIKE '%rpe%'
  OR LOWER(hm.name) LIKE '%exertion%'
  OR LOWER(hm.name) LIKE '%borg%'
  OR LOWER(REPLACE(hm.name, ' ', '_')) LIKE '%effort%'
`

const buildRpeProbeRange = (anchorTo: string): { from: string; to: string } => {
  const from = shiftIsoDate(anchorTo, -(RPE_PROBE_LOOKBACK_DAYS - 1))
  return { from, to: anchorTo }
}

const emptyHit = (
  source: RpeSourceId,
  table: string,
  fetchVia: string,
  role: RpeSourceHit['role']
): RpeSourceHit => ({
  source,
  table,
  fetchVia,
  role,
  daysWithData: 0,
  athletesWithData: 0,
  metricNames: [],
  populated: false,
})

export const probeRpeSources = async (args: {
  clubId: string
  to: string
  from?: string
  athleteIds?: string[]
}): Promise<RpeSourceProbe> => {
  const lookback: IsoDateRange = args.from
    ? { from: args.from, to: args.to }
    : buildRpeProbeRange(args.to)

  if (args.athleteIds && args.athleteIds.length === 0) {
    return {
      lookback,
      sources: [
        emptyHit(
          RPE_SOURCE.HEALTH_METRICS,
          'health_metric_values',
          'build_load_summary',
          'session_rpe'
        ),
        emptyHit(
          RPE_SOURCE.SPORT_ACTIVITIES,
          'sport_activities',
          'build_load_summary',
          'session_rpe'
        ),
        emptyHit(RPE_SOURCE.HEALTH_RATINGS, 'health_ratings', 'fetch_wellness_daily', 'body_rpe'),
      ],
      sessionPrimary: null,
      bodyPrimary: null,
      fetchTable: null,
    }
  }

  const athleteFilter = args.athleteIds?.length
    ? `AND a.id IN (${args.athleteIds.map(() => '?').join(', ')})`
    : ''
  const athleteBindings = args.athleteIds ?? []

  const bindings: unknown[] = [args.clubId, lookback.from, lookback.to, ...athleteBindings]

  const result = await db.rawQuery(
    `
    WITH scoped AS (
      SELECT d.id AS day_id, d.date_of_day, d.athlete_id
      FROM days d
      JOIN athletes a ON a.id = d.athlete_id
      WHERE a.club_id = ?
        AND d.date_of_day BETWEEN ? AND ?
        ${athleteFilter}
    )
    SELECT
      (SELECT COUNT(DISTINCT s.date_of_day)::int FROM scoped s
        WHERE EXISTS (
          SELECT 1 FROM health_ratings hr
          JOIN health_metric_values hmv ON hmv.health_id = hr.id
          JOIN health_metrics hm ON hm.id = hmv.metric_id
          WHERE hr.day_id = s.day_id
            AND (${HEALTH_RPE_NAME_SQL})
            AND NULLIF(TRIM(hmv.value), '') IS NOT NULL
        )
      ) AS hm_days,
      (SELECT COUNT(DISTINCT s.athlete_id)::int FROM scoped s
        WHERE EXISTS (
          SELECT 1 FROM health_ratings hr
          JOIN health_metric_values hmv ON hmv.health_id = hr.id
          JOIN health_metrics hm ON hm.id = hmv.metric_id
          WHERE hr.day_id = s.day_id
            AND (${HEALTH_RPE_NAME_SQL})
            AND NULLIF(TRIM(hmv.value), '') IS NOT NULL
        )
      ) AS hm_athletes,
      (SELECT COUNT(DISTINCT s.date_of_day)::int FROM scoped s
        WHERE EXISTS (
          SELECT 1 FROM sport_activities sa
          WHERE sa.day_id = s.day_id AND NULLIF(sa.rpe, 0) IS NOT NULL
        )
      ) AS sa_days,
      (SELECT COUNT(DISTINCT s.athlete_id)::int FROM scoped s
        WHERE EXISTS (
          SELECT 1 FROM sport_activities sa
          WHERE sa.day_id = s.day_id AND NULLIF(sa.rpe, 0) IS NOT NULL
        )
      ) AS sa_athletes,
      (SELECT COUNT(DISTINCT s.date_of_day)::int FROM scoped s
        WHERE EXISTS (
          SELECT 1 FROM health_ratings hr
          WHERE hr.day_id = s.day_id AND hr.body_soreness_rating IS NOT NULL
        )
      ) AS hr_days,
      (SELECT COUNT(DISTINCT s.athlete_id)::int FROM scoped s
        WHERE EXISTS (
          SELECT 1 FROM health_ratings hr
          WHERE hr.day_id = s.day_id AND hr.body_soreness_rating IS NOT NULL
        )
      ) AS hr_athletes,
      (
        SELECT COALESCE(array_agg(DISTINCT hm.name ORDER BY hm.name), ARRAY[]::text[])
        FROM health_ratings hr
        JOIN health_metric_values hmv ON hmv.health_id = hr.id
        JOIN health_metrics hm ON hm.id = hmv.metric_id
        JOIN scoped s ON s.day_id = hr.day_id
        WHERE (${HEALTH_RPE_NAME_SQL})
          AND NULLIF(TRIM(hmv.value), '') IS NOT NULL
      ) AS hm_names
    `,
    bindings
  )

  const row = (result.rows?.[0] ?? result[0] ?? {}) as Record<string, unknown>
  const readN = (key: string): number => Number(row[key] ?? 0) || 0
  const rawNames = row.hm_names
  const metricNames = Array.isArray(rawNames)
    ? rawNames.filter((n): n is string => typeof n === 'string' && n.trim().length > 0)
    : typeof rawNames === 'string'
      ? rawNames
          .replace(/^\{|\}$/g, '')
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
      : []

  const healthMetrics: RpeSourceHit = {
    source: RPE_SOURCE.HEALTH_METRICS,
    table: 'health_metric_values',
    fetchVia: 'build_load_summary',
    role: 'session_rpe',
    daysWithData: readN('hm_days'),
    athletesWithData: readN('hm_athletes'),
    metricNames,
    populated: readN('hm_days') > 0 && readN('hm_athletes') > 0,
  }
  const sportActivities: RpeSourceHit = {
    source: RPE_SOURCE.SPORT_ACTIVITIES,
    table: 'sport_activities',
    fetchVia: 'build_load_summary',
    role: 'session_rpe',
    daysWithData: readN('sa_days'),
    athletesWithData: readN('sa_athletes'),
    metricNames: sportActivitiesColumnNames(readN('sa_days') > 0),
    populated: readN('sa_days') > 0 && readN('sa_athletes') > 0,
  }
  const healthRatings: RpeSourceHit = {
    source: RPE_SOURCE.HEALTH_RATINGS,
    table: 'health_ratings',
    fetchVia: 'fetch_wellness_daily',
    role: 'body_rpe',
    daysWithData: readN('hr_days'),
    athletesWithData: readN('hr_athletes'),
    metricNames: healthRatingsColumnNames(readN('hr_days') > 0),
    populated: readN('hr_days') > 0 && readN('hr_athletes') > 0,
  }

  const sources = [healthMetrics, sportActivities, healthRatings]
  const sessionPrimary = healthMetrics.populated
    ? healthMetrics
    : sportActivities.populated
      ? sportActivities
      : null
  const bodyPrimary = healthRatings.populated ? healthRatings : null

  return {
    lookback,
    sources,
    sessionPrimary,
    bodyPrimary,
    fetchTable: sessionPrimary?.table ?? bodyPrimary?.table ?? null,
  }
}

const sportActivitiesColumnNames = (hit: boolean): string[] => (hit ? ['rpe'] : [])
const healthRatingsColumnNames = (hit: boolean): string[] => (hit ? ['body_soreness_rating'] : [])

export const formatRpeProbeBrief = (probe: RpeSourceProbe): string => {
  const lines = probe.sources.map((hit) => {
    const names = hit.metricNames.length ? ` cols=[${hit.metricNames.join(',')}]` : ''
    return `${hit.source}: ${hit.populated ? 'HIT' : 'empty'} days=${hit.daysWithData} athletes=${hit.athletesWithData} table=${hit.table} via=${hit.fetchVia}${names}`
  })
  const session = probe.sessionPrimary
    ? `session_rpe → ${probe.sessionPrimary.table} (${probe.sessionPrimary.fetchVia})`
    : 'session_rpe → unavailable'
  const body = probe.bodyPrimary
    ? `body_rpe → ${probe.bodyPrimary.table}.body_soreness_rating (${probe.bodyPrimary.fetchVia})`
    : 'body_rpe → unavailable'
  return [
    `RPE probe ${probe.lookback.from}→${probe.lookback.to} (${RPE_PROBE_LOOKBACK_DAYS}d):`,
    ...lines,
    session,
    body,
  ].join('\n')
}
