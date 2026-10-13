import { DateTime } from 'luxon'
import { METRIC_AGGREGATION_METHOD } from '#constants/metrics.constants'
import type { MetricAggregationMethod } from '#constants/metrics.constants'
import { REPORT_VARIABLE_PREFIX } from '#constants/report_builder.constants'
import { parseValdVariableField, type ValdTrialMetricKey } from '#constants/vald_metrics.constants'
import type {
  ReportData,
  ReportDateRange,
  ReportRawPoint,
  ReportVariableDefinition,
  ReportVariableMeta,
} from '#contracts/report_builder'
import HealthRating from '#models_pg/health_rating'
import Sleep from '#models_pg/sleep'
import SportActivity from '#models_pg/sport_activity'
import { loadDerivedData, loadDerivedTables } from '#services/report_builder/load_derived'
import { fetchValdDailyMaxRows } from '#services/vald_tests_service'
import {
  displayUnit,
  periodMetricValuesTable,
  toHoursFactor,
} from '#services/report_builder/report_units'
import { loadTimeSeriesData } from '#services/report_builder/load_time_series'
import db from '@adonisjs/lucid/services/db'

type EavRow = {
  date_of_day: string
  name: string
  value: string
  athlete_id: string
}

const roundMetricValue = (value: number): number => Math.round(value * 100) / 100

const parseNumericValue = (value: unknown): number | null => {
  if (value === null || value === undefined || value === '') return null
  const numeric = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(numeric) ? numeric : null
}

const readModelNumber = (model: object, field: string): number | null =>
  parseNumericValue((model as Record<string, unknown>)[field])

const readSleepField = (sleep: Sleep, field: string): number | null => {
  if (field === 'durationHours') {
    const hours = parseNumericValue(sleep.totalInBedTimeMilli)
    if (hours === null || hours <= 0) return null
    return hours / (1000 * 60 * 60)
  }
  const value = readModelNumber(sleep, field)
  if (value === null || value === 0) return null
  return value
}

const dayIsoDate = (dateOfDay: DateTime | string | Date): string | null => {
  if (DateTime.isDateTime(dateOfDay)) return dateOfDay.toISODate()
  if (dateOfDay instanceof Date) return DateTime.fromJSDate(dateOfDay, { zone: 'utc' }).toISODate()
  return String(dateOfDay).slice(0, 10)
}

const buildDateAxis = (dateRange: ReportDateRange): string[] => {
  const from = DateTime.fromISO(dateRange.from).startOf('day')
  const to = DateTime.fromISO(dateRange.to).startOf('day')
  if (!from.isValid || !to.isValid || to < from) {
    throw new Error('Invalid date range')
  }

  const dates: string[] = []
  for (let cursor = from; cursor <= to; cursor = cursor.plus({ days: 1 })) {
    dates.push(cursor.toISODate()!)
  }
  return dates
}

const aggregateValues = (values: number[], method: MetricAggregationMethod): number | null => {
  if (values.length === 0) return null

  switch (method) {
    case METRIC_AGGREGATION_METHOD.SUM:
      return values.reduce((sum, value) => sum + value, 0)
    case METRIC_AGGREGATION_METHOD.AVERAGE:
      return values.reduce((sum, value) => sum + value, 0) / values.length
    case METRIC_AGGREGATION_METHOD.MAX:
      return Math.max(...values)
    case METRIC_AGGREGATION_METHOD.MIN:
      return Math.min(...values)
    default:
      return null
  }
}

const filterPoints = (points: ReportRawPoint[], athleteIds?: string[]): ReportRawPoint[] => {
  if (!athleteIds?.length) return points
  const allowed = new Set(athleteIds)
  return points.filter((point) => allowed.has(point.athleteId))
}

const toDailySeries = (
  dates: string[],
  points: ReportRawPoint[],
  method: MetricAggregationMethod
): { series: (number | null)[]; total: number | null } => {
  const byDate = new Map<string, number[]>()
  for (const point of points) {
    const bucket = byDate.get(point.date) ?? []
    bucket.push(point.value)
    byDate.set(point.date, bucket)
  }

  const series = dates.map((date) => {
    const values = byDate.get(date)
    if (!values) return null
    const aggregated = aggregateValues(values, method)
    return aggregated === null ? null : roundMetricValue(aggregated)
  })

  const total = aggregateValues(
    points.map((point) => point.value),
    method
  )

  return {
    series,
    total: total === null ? null : roundMetricValue(total),
  }
}

export const getMeta = (data: ReportData, key: string): ReportVariableMeta | null =>
  data.meta[key] ?? null

export const getSeries = (
  data: ReportData,
  key: string,
  athleteIds?: string[]
): (number | null)[] => {
  const meta = data.meta[key]
  const points = filterPoints(data.points[key] ?? [], athleteIds)
  if (!meta) return data.dates.map(() => null)
  return toDailySeries(data.dates, points, meta.aggregation).series
}

export const getTotal = (data: ReportData, key: string, athleteIds?: string[]): number | null => {
  const meta = data.meta[key]
  if (!meta) return null
  const points = filterPoints(data.points[key] ?? [], athleteIds)
  return toDailySeries(data.dates, points, meta.aggregation).total
}

export const sliceReportData = (data: ReportData, dateRange: ReportDateRange): ReportData => {
  const first = data.dates[0]
  const last = data.dates.at(-1)
  if (first === dateRange.from && last === dateRange.to) return data

  const dates = data.dates.filter((date) => date >= dateRange.from && date <= dateRange.to)
  const inWindow = (date: string) => date >= dateRange.from && date <= dateRange.to

  return {
    ...data,
    dates,
    points: Object.fromEntries(
      Object.entries(data.points).map(([key, rows]) => [
        key,
        rows.filter((row) => inWindow(row.date)),
      ])
    ),
    curves: Object.fromEntries(
      Object.entries(data.curves).map(([key, rows]) => [
        key,
        rows.filter((row) => inWindow(row.date)),
      ])
    ),
    tables: Object.fromEntries(
      Object.entries(data.tables).map(([key, table]) => [
        key,
        {
          ...table,
          rows: table.rows.filter(
            (row) => row.start <= dateRange.to && (row.end === null || row.end >= dateRange.from)
          ),
        },
      ])
    ),
  }
}

const definitionsByPrefix = (
  definitions: ReportVariableDefinition[],
  prefix: ReportVariableDefinition['prefix']
): ReportVariableDefinition[] => definitions.filter((definition) => definition.prefix === prefix)

const withDisplayUnit = (definition: ReportVariableDefinition): ReportVariableDefinition => ({
  ...definition,
  unit: displayUnit(definition.field, definition.unit),
})

const emptyPayload = (dates: string[], definitions: ReportVariableDefinition[]): ReportData => ({
  dates,
  points: Object.fromEntries(definitions.map((definition) => [definition.key, []])),
  curves: Object.fromEntries(definitions.map((definition) => [definition.key, []])),
  tables: Object.fromEntries(
    definitions.map((definition) => [definition.key, { columns: [], rows: [] }])
  ),
  meta: Object.fromEntries(
    definitions.map((definition) => [definition.key, withDisplayUnit(definition)])
  ),
  athletes: {},
})

const loadSportActivityPoints = async (
  clubId: string,
  dateRange: ReportDateRange,
  definitions: ReportVariableDefinition[]
): Promise<Map<string, ReportRawPoint[]>> => {
  const pointsByKey = new Map(
    definitions.map((definition) => [definition.key, [] as ReportRawPoint[]])
  )
  if (definitions.length === 0) return pointsByKey

  const fields = [...new Set(definitions.map((definition) => definition.field))]
  const activities = await SportActivity.query()
    .whereHas('day', (dayQuery) => {
      dayQuery
        .whereBetween('dateOfDay', [dateRange.from, dateRange.to])
        .whereHas('athlete', (athleteQuery) => athleteQuery.where('clubId', clubId))
    })
    .preload('day')
    .select(['id', 'dayId', ...fields])

  for (const activity of activities) {
    const date = dayIsoDate(activity.day.dateOfDay)
    if (!date) continue

    for (const definition of definitions) {
      const value = readModelNumber(activity, definition.field)
      if (value === null) continue
      pointsByKey.get(definition.key)!.push({
        date,
        value,
        athleteId: activity.day.athleteId,
      })
    }
  }

  return pointsByKey
}

const loadHealthColumnPoints = async (
  clubId: string,
  dateRange: ReportDateRange,
  definitions: ReportVariableDefinition[]
): Promise<Map<string, ReportRawPoint[]>> => {
  const pointsByKey = new Map(
    definitions.map((definition) => [definition.key, [] as ReportRawPoint[]])
  )
  if (definitions.length === 0) return pointsByKey

  const fields = [...new Set(definitions.map((definition) => definition.field))]
  const ratings = await HealthRating.query()
    .whereHas('day', (dayQuery) => {
      dayQuery
        .whereBetween('dateOfDay', [dateRange.from, dateRange.to])
        .whereHas('athlete', (athleteQuery) => athleteQuery.where('clubId', clubId))
    })
    .preload('day')
    .select(['id', 'dayId', ...fields])

  for (const rating of ratings) {
    const date = dayIsoDate(rating.day.dateOfDay)
    if (!date) continue

    for (const definition of definitions) {
      const value = readModelNumber(rating, definition.field)
      if (value === null) continue
      pointsByKey.get(definition.key)!.push({
        date,
        value,
        athleteId: rating.day.athleteId,
      })
    }
  }

  return pointsByKey
}

const loadSleepColumnPoints = async (
  clubId: string,
  dateRange: ReportDateRange,
  definitions: ReportVariableDefinition[]
): Promise<Map<string, ReportRawPoint[]>> => {
  const pointsByKey = new Map(
    definitions.map((definition) => [definition.key, [] as ReportRawPoint[]])
  )
  if (definitions.length === 0) return pointsByKey

  const sleeps = await Sleep.query()
    .whereHas('day', (dayQuery) => {
      dayQuery
        .whereBetween('dateOfDay', [dateRange.from, dateRange.to])
        .whereHas('athlete', (athleteQuery) => athleteQuery.where('clubId', clubId))
    })
    .preload('day')

  for (const sleep of sleeps) {
    const date = dayIsoDate(sleep.day.dateOfDay)
    if (!date) continue

    for (const definition of definitions) {
      const value = readSleepField(sleep, definition.field)
      if (value === null) continue
      pointsByKey.get(definition.key)!.push({
        date,
        value,
        athleteId: sleep.day.athleteId,
      })
    }
  }

  return pointsByKey
}

const applyEntireSessionFilter = (query: ReturnType<typeof db.from>) => {
  query.where((subQuery) => {
    subQuery.whereILike('p.name', '%entire session%').orWhereRaw(
      `NOT EXISTS (
        SELECT 1 FROM periods AS p2
        WHERE p2.sport_activity_id = p.sport_activity_id
          AND p2.name ILIKE ?
      )`,
      ['%entire session%']
    )
  })
}

const loadPeriodMetricPoints = async (
  clubId: string,
  dateRange: ReportDateRange,
  definitions: ReportVariableDefinition[],
  useImputedMetrics = false
): Promise<Map<string, ReportRawPoint[]>> => {
  const pointsByKey = new Map(
    definitions.map((definition) => [definition.key, [] as ReportRawPoint[]])
  )
  if (definitions.length === 0) return pointsByKey

  const names = definitions.map((definition) => definition.field)
  const query = db
    .from(periodMetricValuesTable(useImputedMetrics))
    .join('periods as p', 'p.id', 'pmv.period_id')
    .join('period_metrics as pm', 'pm.id', 'pmv.metric_id')
    .join('sport_activities as sa', 'sa.id', 'p.sport_activity_id')
    .join('days as d', 'd.id', 'sa.day_id')
    .join('athletes as a', 'a.id', 'd.athlete_id')
    .where('a.club_id', clubId)
    .whereBetween('d.date_of_day', [dateRange.from, dateRange.to])
    .whereIn('pm.name', names)

  applyEntireSessionFilter(query)

  const rows = (await query.select(
    db.raw("to_char(d.date_of_day, 'YYYY-MM-DD') as date_of_day"),
    'pm.name',
    'pmv.value',
    'd.athlete_id'
  )) as EavRow[]

  const keyByName = new Map(definitions.map((definition) => [definition.field, definition.key]))
  for (const row of rows) {
    const key = keyByName.get(row.name)
    if (!key) continue
    const value = parseNumericValue(row.value)
    if (value === null) continue
    pointsByKey.get(key)!.push({
      date: row.date_of_day,
      value,
      athleteId: row.athlete_id,
    })
  }

  return pointsByKey
}

const loadHealthMetricPoints = async (
  clubId: string,
  dateRange: ReportDateRange,
  definitions: ReportVariableDefinition[]
): Promise<Map<string, ReportRawPoint[]>> => {
  const pointsByKey = new Map(
    definitions.map((definition) => [definition.key, [] as ReportRawPoint[]])
  )
  if (definitions.length === 0) return pointsByKey

  const names = definitions.map((definition) => definition.field)
  const rows = (await db
    .from('health_metric_values as hmv')
    .join('health_metrics as hm', 'hm.id', 'hmv.metric_id')
    .join('health_ratings as hr', 'hr.id', 'hmv.health_id')
    .join('days as d', 'd.id', 'hr.day_id')
    .join('athletes as a', 'a.id', 'd.athlete_id')
    .where('a.club_id', clubId)
    .whereBetween('d.date_of_day', [dateRange.from, dateRange.to])
    .whereIn('hm.name', names)
    .select(
      db.raw("to_char(d.date_of_day, 'YYYY-MM-DD') as date_of_day"),
      'hm.name',
      'hmv.value',
      'd.athlete_id'
    )) as EavRow[]

  const keyByName = new Map(definitions.map((definition) => [definition.field, definition.key]))
  for (const row of rows) {
    const key = keyByName.get(row.name)
    if (!key) continue
    const value = parseNumericValue(row.value)
    if (value === null) continue
    pointsByKey.get(key)!.push({
      date: row.date_of_day,
      value,
      athleteId: row.athlete_id,
    })
  }

  return pointsByKey
}

const loadSleepMetricPoints = async (
  clubId: string,
  dateRange: ReportDateRange,
  definitions: ReportVariableDefinition[]
): Promise<Map<string, ReportRawPoint[]>> => {
  const pointsByKey = new Map(
    definitions.map((definition) => [definition.key, [] as ReportRawPoint[]])
  )
  if (definitions.length === 0) return pointsByKey

  const names = definitions.map((definition) => definition.field)
  const rows = (await db
    .from('sleep_metric_values as smv')
    .join('sleep_metrics as sm', 'sm.id', 'smv.metric_id')
    .join('sleeps as s', 's.id', 'smv.sleep_id')
    .join('days as d', 'd.id', 's.day_id')
    .join('athletes as a', 'a.id', 'd.athlete_id')
    .where('a.club_id', clubId)
    .whereBetween('d.date_of_day', [dateRange.from, dateRange.to])
    .whereIn('sm.name', names)
    .select(
      db.raw("to_char(d.date_of_day, 'YYYY-MM-DD') as date_of_day"),
      'sm.name',
      'smv.value',
      'd.athlete_id'
    )) as EavRow[]

  const keyByName = new Map(definitions.map((definition) => [definition.field, definition.key]))
  for (const row of rows) {
    const key = keyByName.get(row.name)
    if (!key) continue
    const value = parseNumericValue(row.value)
    if (value === null) continue
    pointsByKey.get(key)!.push({
      date: row.date_of_day,
      value,
      athleteId: row.athlete_id,
    })
  }

  return pointsByKey
}

const loadDayMetricPoints = async (
  clubId: string,
  dateRange: ReportDateRange,
  definitions: ReportVariableDefinition[]
): Promise<Map<string, ReportRawPoint[]>> => {
  const pointsByKey = new Map(
    definitions.map((definition) => [definition.key, [] as ReportRawPoint[]])
  )
  if (definitions.length === 0) return pointsByKey

  const names = definitions.map((definition) => definition.field)
  const rows = (await db
    .from('day_metric_values as dmv')
    .join('day_metrics as dm', 'dm.id', 'dmv.metric_id')
    .join('days as d', 'd.id', 'dmv.day_id')
    .join('athletes as a', 'a.id', 'd.athlete_id')
    .where('a.club_id', clubId)
    .whereBetween('d.date_of_day', [dateRange.from, dateRange.to])
    .whereIn('dm.name', names)
    .select(
      db.raw("to_char(d.date_of_day, 'YYYY-MM-DD') as date_of_day"),
      'dm.name',
      'dmv.value',
      'd.athlete_id'
    )) as EavRow[]

  const keyByName = new Map(definitions.map((definition) => [definition.field, definition.key]))
  for (const row of rows) {
    const key = keyByName.get(row.name)
    if (!key) continue
    const value = parseNumericValue(row.value)
    if (value === null) continue
    pointsByKey.get(key)!.push({
      date: row.date_of_day,
      value,
      athleteId: row.athlete_id,
    })
  }

  return pointsByKey
}

const loadBiomarkerPoints = async (
  clubId: string,
  dateRange: ReportDateRange,
  definitions: ReportVariableDefinition[]
): Promise<Map<string, ReportRawPoint[]>> => {
  const pointsByKey = new Map(
    definitions.map((definition) => [definition.key, [] as ReportRawPoint[]])
  )
  if (definitions.length === 0) return pointsByKey

  const names = definitions.map((definition) => definition.field)
  const rows = (await db
    .from('biomarkers as b')
    .join('athletes as a', 'a.id', 'b.athlete_id')
    .join('biomarker_types as bt', 'bt.id', 'b.biomarker_type_id')
    .where('a.club_id', clubId)
    .whereRaw('b.measured_at::date between ? and ?', [dateRange.from, dateRange.to])
    .whereIn('bt.name', names)
    .whereNotNull('b.value')
    .whereNot('b.value', '')
    .select(
      db.raw("to_char(b.measured_at::date, 'YYYY-MM-DD') as date_of_day"),
      'bt.name',
      'b.value',
      'b.athlete_id'
    )) as EavRow[]

  const keyByName = new Map(definitions.map((definition) => [definition.field, definition.key]))
  for (const row of rows) {
    const key = keyByName.get(row.name)
    if (!key) continue
    const value = parseNumericValue(row.value)
    if (value === null) continue
    pointsByKey.get(key)!.push({
      date: row.date_of_day,
      value,
      athleteId: row.athlete_id,
    })
  }

  return pointsByKey
}

const loadValdPoints = async (
  clubId: string,
  dateRange: ReportDateRange,
  definitions: ReportVariableDefinition[]
): Promise<Map<string, ReportRawPoint[]>> => {
  const pointsByKey = new Map(
    definitions.map((definition) => [definition.key, [] as ReportRawPoint[]])
  )
  if (definitions.length === 0) return pointsByKey

  const metricsByTestType = new Map<string, Array<{ metricKey: ValdTrialMetricKey; key: string }>>()
  const metricKeys = new Set<ValdTrialMetricKey>()

  for (const definition of definitions) {
    const parsed = parseValdVariableField(definition.field)
    if (!parsed) continue
    metricKeys.add(parsed.metricKey)
    const list = metricsByTestType.get(parsed.testType) ?? []
    list.push({ metricKey: parsed.metricKey, key: definition.key })
    metricsByTestType.set(parsed.testType, list)
  }
  if (metricsByTestType.size === 0) return pointsByKey

  const rows = await fetchValdDailyMaxRows({
    clubId,
    testTypes: [...metricsByTestType.keys()],
    metricKeys: [...metricKeys],
    from: dateRange.from,
    to: dateRange.to,
  })

  for (const row of rows) {
    const metrics = metricsByTestType.get(row.testType)
    if (!row.athleteId || !row.dateOfDay || !row.testType || !metrics) continue

    for (const { metricKey, key } of metrics) {
      const value = parseNumericValue(row[metricKey])
      if (value === null) continue
      pointsByKey.get(key)!.push({
        date: row.dateOfDay,
        value,
        athleteId: row.athleteId,
      })
    }
  }

  return pointsByKey
}

const loadInsightPoints = async (
  clubId: string,
  dateRange: ReportDateRange,
  definitions: ReportVariableDefinition[]
): Promise<Map<string, ReportRawPoint[]>> => {
  const pointsByKey = new Map(
    definitions.map((definition) => [definition.key, [] as ReportRawPoint[]])
  )
  if (definitions.length === 0) return pointsByKey

  const variableNames = definitions.map((definition) => definition.field)
  const rows = (await db
    .from('feature_importances as fi')
    .join('insights as i', 'i.id', 'fi.insight_id')
    .join('days as d', 'd.id', 'fi.day_id')
    .join('athletes as a', 'a.id', 'd.athlete_id')
    .where('a.club_id', clubId)
    .whereBetween('d.date_of_day', [dateRange.from, dateRange.to])
    .whereIn('i.variable_name', variableNames)
    .whereNotNull('fi.value')
    .select(
      db.raw("to_char(d.date_of_day, 'YYYY-MM-DD') as date_of_day"),
      'i.variable_name as name',
      'fi.value',
      'd.athlete_id'
    )) as EavRow[]

  const keyByName = new Map(definitions.map((definition) => [definition.field, definition.key]))
  for (const row of rows) {
    const key = keyByName.get(row.name)
    if (!key) continue
    const value = parseNumericValue(row.value)
    if (value === null) continue
    pointsByKey.get(key)!.push({
      date: row.date_of_day,
      value,
      athleteId: row.athlete_id,
    })
  }

  return pointsByKey
}

export const loadReportData = async (
  clubId: string,
  dateRange: ReportDateRange,
  definitions: ReportVariableDefinition[],
  athleteIds?: string[],
  useImputedMetrics = false
): Promise<ReportData> => {
  const dates = buildDateAxis(dateRange)
  if (definitions.length === 0) return emptyPayload(dates, definitions)

  const sportActivityDefs = definitionsByPrefix(definitions, REPORT_VARIABLE_PREFIX.SPORT_ACTIVITY)
  const periodMetricDefs = definitionsByPrefix(definitions, REPORT_VARIABLE_PREFIX.PERIOD_METRIC)
  const healthDefs = definitionsByPrefix(definitions, REPORT_VARIABLE_PREFIX.HEALTH)
  const healthMetricDefs = definitionsByPrefix(definitions, REPORT_VARIABLE_PREFIX.HEALTH_METRIC)
  const sleepDefs = definitionsByPrefix(definitions, REPORT_VARIABLE_PREFIX.SLEEP)
  const sleepMetricDefs = definitionsByPrefix(definitions, REPORT_VARIABLE_PREFIX.SLEEP_METRIC)
  const dayMetricDefs = definitionsByPrefix(definitions, REPORT_VARIABLE_PREFIX.DAY_METRIC)
  const biomarkerDefs = definitionsByPrefix(definitions, REPORT_VARIABLE_PREFIX.BIOMARKER)
  const valdDefs = definitionsByPrefix(definitions, REPORT_VARIABLE_PREFIX.VALD)
  const timeSeriesDefs = definitionsByPrefix(definitions, REPORT_VARIABLE_PREFIX.TIME_SERIES)
  const derivedDefs = definitionsByPrefix(definitions, REPORT_VARIABLE_PREFIX.DERIVED)
  const insightDefs = definitionsByPrefix(definitions, REPORT_VARIABLE_PREFIX.INSIGHT)

  const [
    sportActivity,
    periodMetrics,
    health,
    healthMetrics,
    sleep,
    sleepMetrics,
    dayMetrics,
    biomarkers,
    vald,
    timeSeries,
    derived,
    derivedTables,
    insights,
  ] = await Promise.all([
    loadSportActivityPoints(clubId, dateRange, sportActivityDefs),
    loadPeriodMetricPoints(clubId, dateRange, periodMetricDefs, useImputedMetrics),
    loadHealthColumnPoints(clubId, dateRange, healthDefs),
    loadHealthMetricPoints(clubId, dateRange, healthMetricDefs),
    loadSleepColumnPoints(clubId, dateRange, sleepDefs),
    loadSleepMetricPoints(clubId, dateRange, sleepMetricDefs),
    loadDayMetricPoints(clubId, dateRange, dayMetricDefs),
    loadBiomarkerPoints(clubId, dateRange, biomarkerDefs),
    loadValdPoints(clubId, dateRange, valdDefs),
    loadTimeSeriesData(clubId, dateRange, timeSeriesDefs, athleteIds),
    loadDerivedData(clubId, dateRange, derivedDefs),
    loadDerivedTables(clubId, dateRange, derivedDefs),
    loadInsightPoints(clubId, dateRange, insightDefs),
  ])

  const pointsByKey = new Map<string, ReportRawPoint[]>([
    ...sportActivity,
    ...periodMetrics,
    ...health,
    ...healthMetrics,
    ...sleep,
    ...sleepMetrics,
    ...dayMetrics,
    ...biomarkers,
    ...vald,
    ...timeSeries.points,
    ...derived,
    ...insights,
  ])

  const points: ReportData['points'] = {}
  const curves: ReportData['curves'] = {}
  const tables: ReportData['tables'] = {}
  const meta: ReportData['meta'] = {}

  for (const definition of definitions) {
    const factor = toHoursFactor(definition.field)
    const rawPoints = pointsByKey.get(definition.key) ?? []
    points[definition.key] =
      factor === null
        ? rawPoints
        : rawPoints.map((point) => ({ ...point, value: point.value * factor }))
    curves[definition.key] = timeSeries.curves.get(definition.key) ?? []
    tables[definition.key] = derivedTables.get(definition.key) ?? { columns: [], rows: [] }
    meta[definition.key] = withDisplayUnit(definition)
  }

  return { dates, points, curves, tables, meta, athletes: timeSeries.athletes }
}
