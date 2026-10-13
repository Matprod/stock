import {
  REPORT_MAX_TIME_SERIES_CURVES,
  REPORT_TIME_SERIES_POINTS,
} from '#constants/report_builder.constants'
import { HEART_RATE_BPM_MAX, HEART_RATE_BPM_MIN, SERIE_TYPE } from '#constants/serie.constants'
import type { SerieType } from '#constants/serie.constants'
import type {
  ReportDateRange,
  ReportRawPoint,
  ReportTimeSeriesCurve,
  ReportVariableDefinition,
} from '#contracts/report_builder'
import { decodeSeriePoints, downsampleSeriePoints } from '#utils/series'
import db from '@adonisjs/lucid/services/db'

type SeriesRow = {
  type: string
  data_encoded: string
  athlete_id: string
  first_name: string
  last_name: string
  date_of_day: string
  sport_activity_id: string
}

type ActivityRow = {
  sport_activity_id: string
}

const roundMetricValue = (value: number): number => Math.round(value * 100) / 100

const mean = (values: number[]): number | null => {
  if (values.length === 0) return null
  return roundMetricValue(values.reduce((sum, value) => sum + value, 0) / values.length)
}

const isValidSample = (type: string, value: number): boolean => {
  if (type === SERIE_TYPE.HEART_RATE) {
    return value >= HEART_RATE_BPM_MIN && value <= HEART_RATE_BPM_MAX
  }
  if (type === SERIE_TYPE.POWER_IN_WATTS) return value >= 0 && value < 5000
  if (type === SERIE_TYPE.SPEED_METERS_PER_SECOND) return value >= 0
  if (type === SERIE_TYPE.TOTAL_DISTANCE_IN_METERS) return value >= 0
  return Number.isFinite(value)
}

const scopedSeriesQuery = (
  clubId: string,
  dateRange: ReportDateRange,
  types: string[],
  athleteIds?: string[]
) => {
  const query = db
    .from('series as s')
    .join('periods as p', 'p.id', 's.period_id')
    .join('sport_activities as sa', 'sa.id', 'p.sport_activity_id')
    .join('days as d', 'd.id', 'sa.day_id')
    .join('athletes as a', 'a.id', 'd.athlete_id')
    .where('a.club_id', clubId)
    .whereBetween('d.date_of_day', [dateRange.from, dateRange.to])
    .whereIn('s.type', types)

  if (athleteIds?.length) {
    query.whereIn('a.id', athleteIds)
  }

  return query
}

const loadActivityIds = async (
  clubId: string,
  dateRange: ReportDateRange,
  types: string[],
  athleteIds?: string[]
): Promise<string[]> => {
  const rows = (await scopedSeriesQuery(clubId, dateRange, types, athleteIds)
    .groupBy('sa.id')
    .select('sa.id as sport_activity_id')
    .select(db.raw('MAX(d.date_of_day) as date_of_day'))
    .orderBy('date_of_day', 'desc')
    .limit(REPORT_MAX_TIME_SERIES_CURVES)) as ActivityRow[]

  return rows.map((row) => row.sport_activity_id)
}

const toCurvePoints = (
  type: SerieType,
  encodedChunks: string[]
): Array<{ elapsedSec: number; value: number }> => {
  const raw = encodedChunks.flatMap((encoded) => {
    try {
      return decodeSeriePoints(encoded, type)
    } catch {
      return []
    }
  })

  const filtered = raw
    .filter((point) => isValidSample(type, point.value))
    .sort((left, right) => left.ts - right.ts)

  if (filtered.length === 0) return []

  const t0 = filtered[0].ts
  const normalized = filtered.map((point) => ({
    ts: Math.max(0, point.ts - t0),
    value: point.value,
  }))
  return downsampleSeriePoints(normalized, REPORT_TIME_SERIES_POINTS).map((point) => ({
    elapsedSec: point.ts,
    value: roundMetricValue(point.value),
  }))
}

export const loadTimeSeriesData = async (
  clubId: string,
  dateRange: ReportDateRange,
  definitions: ReportVariableDefinition[],
  athleteIds?: string[]
): Promise<{
  points: Map<string, ReportRawPoint[]>
  curves: Map<string, ReportTimeSeriesCurve[]>
  athletes: Record<string, string>
}> => {
  const pointsByKey = new Map(
    definitions.map((definition) => [definition.key, [] as ReportRawPoint[]])
  )
  const curvesByKey = new Map(
    definitions.map((definition) => [definition.key, [] as ReportTimeSeriesCurve[]])
  )
  const athletes: Record<string, string> = {}

  if (definitions.length === 0) return { points: pointsByKey, curves: curvesByKey, athletes }

  const types = [...new Set(definitions.map((definition) => definition.field))]
  const activityIds = await loadActivityIds(clubId, dateRange, types, athleteIds)
  if (activityIds.length === 0) return { points: pointsByKey, curves: curvesByKey, athletes }

  const rows = (await db
    .from('series as s')
    .join('periods as p', 'p.id', 's.period_id')
    .join('sport_activities as sa', 'sa.id', 'p.sport_activity_id')
    .join('days as d', 'd.id', 'sa.day_id')
    .join('athletes as a', 'a.id', 'd.athlete_id')
    .whereIn('sa.id', activityIds)
    .whereIn('s.type', types)
    .select(
      's.type',
      's.data_encoded',
      'd.athlete_id',
      'a.first_name',
      'a.last_name',
      db.raw("to_char(d.date_of_day, 'YYYY-MM-DD') as date_of_day"),
      'sa.id as sport_activity_id'
    )
    .orderBy('p.start_time', 'asc')) as SeriesRow[]

  const keyByType = new Map(definitions.map((definition) => [definition.field, definition.key]))
  const grouped = new Map<
    string,
    {
      key: string
      type: string
      athleteId: string
      activityId: string
      date: string
      encoded: string[]
    }
  >()

  for (const row of rows) {
    const key = keyByType.get(row.type)
    if (!key) continue
    athletes[row.athlete_id] = `${row.first_name} ${row.last_name}`.trim()
    const groupKey = `${row.sport_activity_id}:${row.type}`
    const existing = grouped.get(groupKey)
    if (existing) {
      existing.encoded.push(row.data_encoded)
      continue
    }
    grouped.set(groupKey, {
      key,
      type: row.type,
      athleteId: row.athlete_id,
      activityId: row.sport_activity_id,
      date: row.date_of_day,
      encoded: [row.data_encoded],
    })
  }

  for (const group of grouped.values()) {
    const points = toCurvePoints(group.type as SerieType, group.encoded)
    if (points.length === 0) continue

    curvesByKey.get(group.key)!.push({
      athleteId: group.athleteId,
      activityId: group.activityId,
      date: group.date,
      points,
    })

    const sessionMean = mean(points.map((point) => point.value))
    if (sessionMean === null) continue
    pointsByKey.get(group.key)!.push({
      date: group.date,
      value: sessionMean,
      athleteId: group.athleteId,
    })
  }

  return { points: pointsByKey, curves: curvesByKey, athletes }
}
