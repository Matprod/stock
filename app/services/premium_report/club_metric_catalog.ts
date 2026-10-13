import { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import { CLUB_METRICS_LOOKBACK_DAYS } from '#constants/agent.constants'
import { CHATBOT_FILTERED_PERIOD_METRICS } from '#constants/chatbot.constants'
import type { GpsIntensityKpi, PremiumAggKpi } from '#constants/premium_report_metrics'
import {
  getClubHealthMetricNames,
  getClubPeriodMetricCatalogue,
  getPeriodMetricAggregationMethods,
} from '#utils/agent/agent_catalogue'
import { shiftIsoDate, type IsoDateRange } from '#services/report_v4/lookback_range'

type CatalogRow = {
  name: string
  unit: string
  aggregationMethod: string
}

export type ClubMetricCatalog = {
  periodKpis: GpsIntensityKpi[]
  periodNames: string[]
  matchKpis: PremiumAggKpi[]
  matchNames: string[]
  namesByUnit: (unitKind: 'distance' | 'duration') => string[]
  rpeNames: string[]
}

export type ClubMetricCatalogDateRange = IsoDateRange

const CACHE_TTL_MS = 60_000
const MAX_CATALOG_SPAN_DAYS = 90
const MAX_PERIOD_KPI_COLUMNS = 48
const MAX_MATCH_KPI_COLUMNS = 48
const CATALOG_FETCH_DOMAINS = new Set(['load', 'gps', 'match'])
const catalogCache = new Map<string, { at: number; value: ClubMetricCatalog }>()

const NOISE_PERIOD_NAMES = new Set(
  (CHATBOT_FILTERED_PERIOD_METRICS as readonly string[]).map((name) => name.toLowerCase())
)
const ZONE_OR_BAND_RE = /(?:^|[_\s-])(?:zone\d*|z\d+|band\d+)/i
const UNIT_KIND_RE: Record<'distance' | 'duration', RegExp> = {
  distance: /^(m|km|metre|meter|meters|metres|yd|yard|yards)\b/i,
  duration: /^(s|sec|secs|second|seconds|min|mins|minute|minutes|h|hr|hour|hours)\b/i,
}

const sqlAlias = (raw: string): string => {
  const cleaned = raw.replace(/[^a-zA-Z0-9_]/g, '_').replace(/^(\d)/, '_$1')
  return cleaned.slice(0, 48) || 'metric'
}

const aggFor = (method: string): PremiumAggKpi['agg'] => {
  const upper = method.toUpperCase()
  if (upper === 'MAX') return 'MAX'
  if (upper === 'AVG' || upper === 'AVERAGE') return 'AVG'
  if (upper === 'SUM') return 'SUM'
  return 'SUM'
}

const digitsFor = (unit: string, agg: PremiumAggKpi['agg']): number => {
  if (agg === 'AVG') return 1
  if (/km|ratio|%|au\b|load/i.test(unit)) return 1
  return 0
}

const uniqueSqlAliases = (names: string[]): Map<string, string> => {
  const aliasByName = new Map<string, string>()
  const used = new Set<string>()
  for (const name of names) {
    let alias = sqlAlias(name)
    let n = 2
    while (used.has(alias)) {
      alias = `${sqlAlias(name)}_${n}`
      n += 1
    }
    used.add(alias)
    aliasByName.set(name, alias)
  }
  return aliasByName
}

const preferAbsOverRelTwin = (names: string[]): string[] => {
  const available = new Set(names)
  const filtered = names.filter((name) => {
    if (!/rel$/i.test(name)) return true
    const absTwin = name.replace(/[Rr]el$/, 'Abs')
    return !available.has(absTwin)
  })
  return filtered.length > 0 ? filtered : names
}

const rankPeriodNames = (rows: CatalogRow[]): string[] => {
  const names = preferAbsOverRelTwin([...new Set(rows.map((row) => row.name).filter(Boolean))])
  const byName = new Map(rows.map((row) => [row.name, row]))
  const score = (name: string): number => {
    const unit = byName.get(name)?.unit ?? ''
    let points = 0
    const distanceUnit = UNIT_KIND_RE.distance.test(unit.trim())
    if (distanceUnit && /distance/i.test(name) && !/accel|decel/i.test(name)) points += 100
    else if (distanceUnit) points += 40
    if (/abs$/i.test(name)) points += 20
    if (/rel$/i.test(name)) points -= 10
    if (ZONE_OR_BAND_RE.test(name)) points -= 30
    return points
  }
  return [...names].sort((left, right) => score(right) - score(left) || left.localeCompare(right))
}

const kpisFromRows = (
  rows: CatalogRow[],
  maxColumns: number,
  orderedNames?: string[]
): PremiumAggKpi[] => {
  const names = orderedNames ?? [...new Set(rows.map((row) => row.name).filter(Boolean))]
  const byName = new Map(rows.map((row) => [row.name, row]))
  const aliases = uniqueSqlAliases(names)
  return names.slice(0, maxColumns).map((name) => {
    const row = byName.get(name)
    const agg = aggFor(row?.aggregationMethod ?? '')
    return {
      name,
      alias: aliases.get(name) ?? sqlAlias(name),
      agg,
      digits: digitsFor(row?.unit ?? '', agg),
    }
  })
}

const periodKpisFromRows = (rows: CatalogRow[]): GpsIntensityKpi[] =>
  kpisFromRows(rows, MAX_PERIOD_KPI_COLUMNS, rankPeriodNames(rows))

export const selectPeriodKpis = (
  catalog: ClubMetricCatalog,
  preferredNames: string[] = []
): GpsIntensityKpi[] => {
  if (preferredNames.length === 0) return catalog.periodKpis
  const byName = new Map(catalog.periodKpis.map((kpi) => [kpi.name, kpi]))
  const preferred: GpsIntensityKpi[] = []
  const seen = new Set<string>()
  for (const name of preferredNames) {
    if (!catalog.periodNames.includes(name) || seen.has(name)) continue
    const existing = byName.get(name)
    preferred.push(
      existing ?? {
        name,
        alias: sqlAlias(name),
        agg: 'SUM',
        digits: 0,
      }
    )
    seen.add(name)
  }
  const rest = catalog.periodKpis.filter((kpi) => !seen.has(kpi.name))
  return [...preferred, ...rest].slice(0, MAX_PERIOD_KPI_COLUMNS)
}

const CATEGORICAL_MATCH_METRIC_RE =
  /match_?result|(?:^|_)result$|win_?loss|outcome|opponent|home_?away|venue|scoreline/i

const rankMatchNames = (rows: CatalogRow[]): string[] => {
  const names = [...new Set(rows.map((row) => row.name).filter(Boolean))].filter(
    (name) => !CATEGORICAL_MATCH_METRIC_RE.test(name)
  )
  const score = (name: string): number => {
    let points = 0
    if (/minutes_?played|playing.?time|basketball_minutes/i.test(name)) points += 40
    if (/points|basketball_points/i.test(name)) points += 35
    if (/total_?distance/i.test(name)) points += 30
    if (/sprint/i.test(name)) points += 20
    if (/intensive_?run/i.test(name)) points += 18
    if (/max_?speed|top_?speed/i.test(name)) points += 16
    if (/tackles_?won/i.test(name)) points += 14
    if (/tackles_?contested|tackles/i.test(name)) points += 12
    if (/assists|rebounds|jumps|player_load/i.test(name)) points += 10
    return points
  }
  return names.sort((left, right) => score(right) - score(left) || left.localeCompare(right))
}

export const selectMatchKpis = (
  catalog: ClubMetricCatalog,
  preferredNames: string[] = []
): PremiumAggKpi[] => {
  if (preferredNames.length === 0) return catalog.matchKpis
  const byName = new Map(catalog.matchKpis.map((kpi) => [kpi.name, kpi]))
  const preferred: PremiumAggKpi[] = []
  const seen = new Set<string>()
  for (const name of preferredNames) {
    if (!catalog.matchNames.includes(name) || seen.has(name)) continue
    if (CATEGORICAL_MATCH_METRIC_RE.test(name)) continue
    const existing = byName.get(name)
    preferred.push(
      existing ?? {
        name,
        alias: sqlAlias(name),
        agg: 'SUM',
        digits: 0,
      }
    )
    seen.add(name)
  }
  const rest = catalog.matchKpis.filter((kpi) => !seen.has(kpi.name))
  return [...preferred, ...rest].slice(0, MAX_MATCH_KPI_COLUMNS)
}

const preferSessionTotals = (names: string[], unitKind: 'distance' | 'duration'): string[] => {
  const withoutZones = names.filter((name) => !ZONE_OR_BAND_RE.test(name))
  if (unitKind === 'duration') return withoutZones
  const pool = withoutZones.length > 0 ? withoutZones : names
  const totals = pool.filter((name) => /distance/i.test(name) && !/accel|decel/i.test(name))
  return totals.length > 0 ? totals : pool
}

const filterNamesByUnit = (rows: CatalogRow[], unitKind: 'distance' | 'duration'): string[] => {
  const re = UNIT_KIND_RE[unitKind]
  const names = [
    ...new Set(
      rows
        .filter((row) => row.unit && re.test(row.unit.trim()))
        .map((row) => row.name)
        .filter(Boolean)
    ),
  ]
  return preferSessionTotals(names, unitKind)
}

const unionRanges = (ranges: ClubMetricCatalogDateRange[]): ClubMetricCatalogDateRange | null => {
  if (ranges.length === 0) return null
  let from = ranges[0]!.from
  let to = ranges[0]!.to
  for (const range of ranges) {
    if (range.from < from) from = range.from
    if (range.to > to) to = range.to
  }
  return { from, to }
}

const clampCatalogRange = (range: ClubMetricCatalogDateRange): ClubMetricCatalogDateRange => {
  const fromMs = Date.parse(`${range.from}T12:00:00Z`)
  const toMs = Date.parse(`${range.to}T12:00:00Z`)
  if (!Number.isFinite(fromMs) || !Number.isFinite(toMs) || toMs < fromMs) return range
  const spanDays = Math.round((toMs - fromMs) / 86_400_000) + 1
  if (spanDays <= MAX_CATALOG_SPAN_DAYS) return range
  return { from: shiftIsoDate(range.to, -(MAX_CATALOG_SPAN_DAYS - 1)), to: range.to }
}

const defaultCatalogRange = (): ClubMetricCatalogDateRange => {
  const end = DateTime.utc().toISODate() ?? '2100-01-01'
  return {
    from: shiftIsoDate(end, -(CLUB_METRICS_LOOKBACK_DAYS - 1)),
    to: end,
  }
}

/**
 * Build the GPS/load/match catalogue window from report prompt windows.
 * Prefer load/gps/match (not biomarkers Dec / wellness overrides) + fetchRange for ACWR lookback.
 */
export const resolveClubMetricCatalogRange = (args: {
  displayRange?: ClubMetricCatalogDateRange
  fetchRange?: ClubMetricCatalogDateRange
  domainRanges?: Partial<Record<string, ClubMetricCatalogDateRange | undefined>>
  fetches?: Array<{ domain: string; from: string; to: string }>
}): ClubMetricCatalogDateRange => {
  const ranges: ClubMetricCatalogDateRange[] = []
  for (const fetch of args.fetches ?? []) {
    if (CATALOG_FETCH_DOMAINS.has(fetch.domain)) {
      ranges.push({ from: fetch.from, to: fetch.to })
    }
  }
  for (const domain of CATALOG_FETCH_DOMAINS) {
    const range = args.domainRanges?.[domain]
    if (range) ranges.push(range)
  }
  if (args.fetchRange) ranges.push(args.fetchRange)
  if (args.displayRange) ranges.push(args.displayRange)
  return clampCatalogRange(unionRanges(ranges) ?? defaultCatalogRange())
}

const loadPeriodRowsForClub = async (
  clubId: string,
  range: ClubMetricCatalogDateRange
): Promise<CatalogRow[]> => {
  const lookbackDays =
    Math.round(
      (Date.parse(`${range.to}T12:00:00Z`) - Date.parse(`${range.from}T12:00:00Z`)) / 86_400_000
    ) + 1
  const catalogue = await getClubPeriodMetricCatalogue(clubId, {
    lookbackDays: Math.max(1, lookbackDays),
    referenceDate: range.to,
  })
  const names = catalogue.map((row) => row.name.trim()).filter(Boolean)
  const aggByName = await getPeriodMetricAggregationMethods(names)
  return catalogue
    .map((row) => {
      const name = row.name.trim()
      return {
        name,
        unit: row.unit?.trim() ?? '',
        aggregationMethod: aggByName.get(name) ?? '',
      }
    })
    .filter((row) => row.name && !NOISE_PERIOD_NAMES.has(row.name.toLowerCase()))
}

const loadRpeNamesForClub = async (
  clubId: string,
  range: ClubMetricCatalogDateRange
): Promise<string[]> => {
  const healthNames = await getClubHealthMetricNames({
    clubId,
    startDate: range.from,
    endDate: range.to,
  })
  const rpeNames = healthNames.filter((name) => /rpe/i.test(name))
  if (rpeNames.length > 0) return rpeNames
  return healthNames.filter((name) => /exertion|effort|borg/i.test(name))
}

const loadMatchRowsForClub = async (
  clubId: string,
  range: ClubMetricCatalogDateRange
): Promise<CatalogRow[]> => {
  const rows = await db
    .from('sport_activity_metrics as sam')
    .whereExists((sub) => {
      sub
        .from('sport_activity_metric_values as samv')
        .join('sport_activities as sa', 'sa.id', 'samv.sport_activity_id')
        .join('days as d', 'd.id', 'sa.day_id')
        .join('athletes as a', 'a.id', 'd.athlete_id')
        .whereColumn('samv.metric_id', 'sam.id')
        .where('a.club_id', clubId)
        .where('sa.game_activity', true)
        .whereBetween('d.date_of_day', [range.from, range.to])
        .select(db.raw('1'))
        .limit(1)
    })
    .select(
      'sam.name',
      db.raw("COALESCE(sam.unit, '') AS unit"),
      db.raw("COALESCE(sam.aggregation_method, 'sum') AS aggregation_method")
    )
    .orderBy('sam.name', 'asc')
  return rows
    .map((row) => ({
      name: String(row.name ?? '').trim(),
      unit: String(row.unit ?? '').trim(),
      aggregationMethod: String(row.aggregation_method ?? '').trim(),
    }))
    .filter((row) => row.name)
}

const buildCatalog = async (
  clubId: string,
  range: ClubMetricCatalogDateRange
): Promise<ClubMetricCatalog> => {
  const [rows, matchRows, rpeNames] = await Promise.all([
    loadPeriodRowsForClub(clubId, range),
    loadMatchRowsForClub(clubId, range),
    loadRpeNamesForClub(clubId, range),
  ])
  const distanceNames = filterNamesByUnit(rows, 'distance')
  const durationNames = filterNamesByUnit(rows, 'duration')
  const matchKpis = kpisFromRows(matchRows, MAX_MATCH_KPI_COLUMNS, rankMatchNames(matchRows))
  return {
    periodKpis: periodKpisFromRows(rows),
    periodNames: [...new Set(rows.map((row) => row.name))],
    matchKpis,
    matchNames: matchKpis.map((kpi) => kpi.name),
    namesByUnit: (unitKind) => (unitKind === 'distance' ? distanceNames : durationNames),
    rpeNames,
  }
}

const cacheKey = (clubId: string, range: ClubMetricCatalogDateRange): string =>
  `${clubId}|${range.from}|${range.to}`

export const clubMetricCatalog = async (
  clubId: string,
  dateRange?: ClubMetricCatalogDateRange
): Promise<ClubMetricCatalog> => {
  const range = clampCatalogRange(dateRange ?? defaultCatalogRange())
  const key = cacheKey(clubId, range)
  const cached = catalogCache.get(key)
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.value
  const value = await buildCatalog(clubId, range)
  catalogCache.set(key, { at: Date.now(), value })
  return value
}
