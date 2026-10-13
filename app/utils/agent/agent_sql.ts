import type { AgentContext } from '#contracts/agent'
import { REFERENCE_TABLES, SQL_STATEMENT_TIMEOUT_MS } from '#constants/agent.constants'
import {
  CHATBOT_FILTERED_PERIOD_METRICS,
  isChatbotAllowedPeriodMetric,
} from '#constants/chatbot.constants'
import db from '@adonisjs/lucid/services/db'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'

export const withStatementTimeout = async <T>(
  run: (trx: TransactionClientContract) => Promise<T>
): Promise<T> =>
  db.transaction(async (trx) => {
    await trx.rawQuery(`SET LOCAL statement_timeout = ${SQL_STATEMENT_TIMEOUT_MS}`)
    return run(trx)
  })

export const executeSqlSelectRows = async (sql: string): Promise<Record<string, unknown>[]> => {
  const cleaned = sql.trim().replace(/;\s*$/, '')
  const result = await withStatementTimeout((trx) => trx.rawQuery(cleaned))
  return extractRawQueryRows(result)
}

const SQL_SCHEMA_BLOCKS: Array<{ re: RegExp; hint: string }> = [
  {
    re: /\bbiomarker_values\b/i,
    hint: 'biomarker_values — use table biomarkers JOIN biomarker_types (or fetch_biomarkers macro)',
  },
  {
    re: /\bbiomarker_measurements\b/i,
    hint: 'biomarker_measurements does not exist — use biomarkers JOIN biomarker_types (or fetch_biomarkers)',
  },
  {
    re: /\bbh\.(?:date|measured_at)\b/i,
    hint: 'bodymetrics_histories has no date/measured_at — JOIN days d ON d.id = bh.day_id and filter d.date_of_day. Prefer fetch_body_metrics',
  },
  {
    re: /\bvtr\.(?:jump_height|peak_power|landing_force|peak_force)\b/i,
    hint: 'vald_trials columns are trial_jump_height / trial_peak_takeoff_power / trial_peak_landing_force / trial_rsi. Prefer fetch_vald_tests',
  },
  {
    re: /\bvt\.(?:athlete_id|test_date|test_name|result_value)\b|\bvald_test_values\b/i,
    hint: 'vald_tests has day_id (→ days → athletes), test_type; metrics live on vald_trials as trial_*. Prefer fetch_vald_tests',
  },
]

/** Club override for period metric units: COALESCE(club unit, catalogue default). */
export const periodMetricUnitSql = (): string =>
  `MAX(COALESCE((SELECT pmcu.unit FROM period_metric_club_units pmcu WHERE pmcu.metric_id = pm.id AND pmcu.club_id = a.club_id LIMIT 1), pm.unit))`

const METRIC_VALUES_RE =
  /period_metric_values|\bpmv\b|sport_activity_metric_values|\bsamv\b|health_metric_values|\bhmv\b/i
const BIOMARKER_VALUES_RE = /\bbiomarkers\b/i
const BIOMARKER_VALUE_FIELD_RE = /\b(?:\w+\.)?value\b/i
const BIOMARKER_CAST_RE = /\bcast\s*\(/i
const UNIT_COLUMN_RE = /\.unit\b/i
const AS_UNIT_COLUMN_RE = /\bas\s+unit\b/i
const CASE_WHEN_PIVOT_RE = /CASE\s+WHEN\s+(?:pm|hm|sam)\.name\s*=/i
const LOAD_METRIC_HUNT_RE =
  /\bpm\.name\b[^;]{0,80}(?:player_load|total_player_load|dynamic_stress_load|kpi_dynamicStressLoad|%\s*player\s*%\s*load\s*%|%\s*load\s*%)/i

const metricUnitExpression = (sql: string): string | null => {
  // Only inject when the matching metrics alias is already in the query.
  if (/\bperiod_metrics\s+as\s+pm\b|\bperiod_metrics\s+pm\b|\bpm\.name\b/i.test(sql)) {
    return periodMetricUnitSql()
  }
  if (
    /\bsport_activity_metrics\s+as\s+sam\b|\bsport_activity_metrics\s+sam\b|\bsam\.name\b/i.test(
      sql
    )
  ) {
    return 'MAX(sam.unit)'
  }
  if (/\bhealth_metrics\s+as\s+hm\b|\bhealth_metrics\s+hm\b|\bhm\.name\b/i.test(sql)) {
    return 'MAX(hm.unit)'
  }
  if (/\bbiomarker_types\s+as\s+bt\b|\bbiomarker_types\s+bt\b|\bbt\./i.test(sql)) {
    return 'MAX(bt.unit)'
  }
  return null
}

const touchesMetricOrBiomarkerValues = (sql: string): boolean => {
  if (METRIC_VALUES_RE.test(sql)) return true
  return (
    BIOMARKER_VALUES_RE.test(sql) &&
    (BIOMARKER_VALUE_FIELD_RE.test(sql) || BIOMARKER_CAST_RE.test(sql))
  )
}

const mainSelectFromIndex = (sql: string): number => {
  const withMatch = /^\s*WITH\b/i.exec(sql)
  if (!withMatch) {
    const fromMatch = /\bFROM\b/i.exec(sql)
    return fromMatch?.index ?? -1
  }
  let depth = 0
  let i = withMatch.index + withMatch[0].length
  let sawCteBody = false
  while (i < sql.length) {
    const ch = sql[i]!
    if (ch === '(') {
      depth += 1
      sawCteBody = true
    } else if (ch === ')') {
      depth = Math.max(0, depth - 1)
    } else if (depth === 0 && sawCteBody) {
      const rest = sql.slice(i)
      const selectMatch = /^\s*SELECT\b/i.exec(rest)
      if (selectMatch) {
        const fromMatch = /\bFROM\b/i.exec(sql.slice(i + (selectMatch.index ?? 0)))
        if (!fromMatch || fromMatch.index == null) return -1
        return i + (selectMatch.index ?? 0) + fromMatch.index
      }
    }
    i += 1
  }
  const fallback = /\bFROM\b/i.exec(sql)
  return fallback?.index ?? -1
}

export const ensureMetricUnitInSql = (sql: string): string => {
  if (!touchesMetricOrBiomarkerValues(sql)) return sql
  if (UNIT_COLUMN_RE.test(sql) || AS_UNIT_COLUMN_RE.test(sql) || CASE_WHEN_PIVOT_RE.test(sql)) {
    return sql
  }
  const unitExpr = metricUnitExpression(sql)
  if (!unitExpr) return sql
  const fromIndex = mainSelectFromIndex(sql)
  if (fromIndex < 0) return sql
  const before = sql.slice(0, fromIndex).trimEnd()
  const after = sql.slice(fromIndex)
  const sep = before.endsWith(',') ? ' ' : ', '
  return `${before}${sep}${unitExpr} AS unit\n${after}`
}

export const suggestMetricMacro = (sql: string): string | undefined => {
  if (!METRIC_VALUES_RE.test(sql)) {
    if (BIOMARKER_VALUES_RE.test(sql)) return 'fetch_biomarkers'
    return undefined
  }
  if (/\bdate_of_day\b/i.test(sql) || /\bkpi_dsl\b|\bdsl\b|player_load/i.test(sql)) {
    return 'fetch_gps_intensity_daily'
  }
  if (/\bminutes_played\b|match_stat|sport_activity_metric/i.test(sql)) {
    return /\bdate_of_day\b/i.test(sql) ? 'fetch_match_stats_daily' : 'fetch_match_stats'
  }
  return 'fetch_gps_intensity'
}

export const validateSql = (sql: string, context: AgentContext): string | null => {
  const upper = sql.toUpperCase()

  const dateLiteralPattern = /'(\d{4}-\d{2}-\d{2})'/g
  let match: RegExpExecArray | null
  while ((match = dateLiteralPattern.exec(sql)) !== null) {
    if (match[1] > context.referenceDate) {
      return `Blocked: date '${match[1]}' is after ${context.referenceDate}.`
    }
  }

  if (upper.includes('SELECT *') && !upper.includes('LIMIT')) {
    return 'Blocked: SELECT * requires LIMIT.'
  }

  if (touchesMetricOrBiomarkerValues(sql) && !UNIT_COLUMN_RE.test(sql)) {
    return 'Blocked: metric/biomarker value queries must SELECT `.unit`.'
  }

  if (context.mode === 'athlete') {
    const athleteIdPattern = /\b(athlete_id|id)\s*=\s*'([^']+)'/gi
    while ((match = athleteIdPattern.exec(sql)) !== null) {
      if (match[2] !== context.athleteId) {
        return `Blocked: only athlete ${context.athleteId} is allowed.`
      }
    }
    return null
  }

  if (isReferenceOnlyQuery(sql)) return null

  const disallowedMetric = firstDisallowedPeriodMetric(sql, context.clubId)
  if (disallowedMetric) {
    return `Blocked: pm.name '${disallowedMetric}' is not on this club's chatbot metric whitelist. Use CLUB PERIOD METRICS names only, or fetch_gps_intensity_daily.`
  }

  const athleteSet = new Set(context.athleteIds)
  const athleteIdEqPattern = /\b(athlete_id|id)\s*=\s*'([^']+)'/gi
  while ((match = athleteIdEqPattern.exec(sql)) !== null) {
    if (!athleteSet.has(match[2])) {
      return `Blocked: athlete_id ${match[2]} is not on this team.`
    }
  }

  const athleteIdInPattern = /\b(athlete_id|id)\s+IN\s*\(([^)]+)\)/gi
  while ((match = athleteIdInPattern.exec(sql)) !== null) {
    for (const id of match[2].split(',').map((s) => s.trim().replace(/^'|'$/g, ''))) {
      if (!athleteSet.has(id)) {
        return `Blocked: athlete_id ${id} is not on this team.`
      }
    }
  }

  const clubIdPattern = /\bclub_id\s*=\s*'([^']+)'/gi
  let hasMatchingClubFilter = false
  while ((match = clubIdPattern.exec(sql)) !== null) {
    if (match[1] === context.clubId) hasMatchingClubFilter = true
    else return `Blocked: club_id must be '${context.clubId}'.`
  }

  const hasAthleteRestriction = /\b(athlete_id|id)\s*(=|IN\s*\()/i.test(sql)
  if (!hasMatchingClubFilter && !hasAthleteRestriction) {
    return `Blocked: filter by club_id = '${context.clubId}' or team athlete_id.`
  }

  return null
}

export const validateReportSql = (sql: string, context: AgentContext): string | null => {
  const upper = sql.toUpperCase()

  const dateLiteralPattern = /'(\d{4}-\d{2}-\d{2})'/g
  let match: RegExpExecArray | null
  while ((match = dateLiteralPattern.exec(sql)) !== null) {
    if (match[1] > context.referenceDate) {
      return `Blocked: date '${match[1]}' is after ${context.referenceDate}.`
    }
  }

  if (upper.includes('SELECT *') && !upper.includes('LIMIT')) {
    return 'Blocked: SELECT * requires LIMIT.'
  }

  for (const rule of SQL_SCHEMA_BLOCKS) {
    if (rule.re.test(sql)) return `Blocked: ${rule.hint}.`
  }

  if (
    touchesMetricOrBiomarkerValues(sql) &&
    LOAD_METRIC_HUNT_RE.test(sql) &&
    !CASE_WHEN_PIVOT_RE.test(sql)
  ) {
    return 'Blocked: player load / DSL lives on fetch_gps_intensity_daily as columns dsl + player_load. Filter that dataset by joueur → add_chart line. Do not free-SQL hunt pm.name.'
  }

  if (
    touchesMetricOrBiomarkerValues(sql) &&
    !UNIT_COLUMN_RE.test(sql) &&
    !CASE_WHEN_PIVOT_RE.test(sql)
  ) {
    const macro = suggestMetricMacro(sql)
    return `Blocked: free SQL on metric/biomarker values needs unit (COALESCE club period unit / pm.unit, or MAX(sam.unit)) or CASE WHEN pm.name= pivot. Prefer macro ${macro ?? 'fetch_gps_intensity_daily'} — do not multi-JOIN period_metric_values.`
  }

  if (context.mode === 'athlete') {
    const athleteIdPattern = /\b(athlete_id|id)\s*=\s*'([^']+)'/gi
    while ((match = athleteIdPattern.exec(sql)) !== null) {
      if (match[2] !== context.athleteId) {
        return `Blocked: only athlete ${context.athleteId} is allowed.`
      }
    }
    return null
  }

  if (isReferenceOnlyQuery(sql)) return null

  const stripped = stripSqlComments(sql)
  const athleteSet = new Set(context.athleteIds)
  const athleteIdEqPattern = /\b(?:athlete_id|a\.id)\s*=\s*'([^']+)'/gi
  while ((match = athleteIdEqPattern.exec(stripped)) !== null) {
    if (match[1] === context.clubId) continue
    if (!isUuid(match[1])) continue
    if (!athleteSet.has(match[1])) {
      return `Blocked: athlete_id ${match[1]} is not on this team.`
    }
  }

  const athleteIdInPattern = /\b(?:athlete_id|a\.id)\s+IN\s*\(([^)]+)\)/gi
  while ((match = athleteIdInPattern.exec(stripped)) !== null) {
    for (const id of match[1].split(',').map((s) => s.trim().replace(/^'|'$/g, ''))) {
      if (!isUuid(id) || id === context.clubId) continue
      if (!athleteSet.has(id)) {
        return `Blocked: athlete_id ${id} is not on this team.`
      }
    }
  }

  const clubIdPattern = /\bclub_id\s*=\s*'([^']+)'/gi
  let hasMatchingClubFilter = false
  while ((match = clubIdPattern.exec(stripped)) !== null) {
    if (match[1] === context.clubId) hasMatchingClubFilter = true
    else return `Blocked: club_id must be '${context.clubId}'.`
  }

  if (!hasMatchingClubFilter) {
    return `Blocked: team queries must filter club_id = '${context.clubId}' (JOIN athletes a … WHERE a.club_id = '${context.clubId}'). A JOIN on athlete_id = a.id is not a club filter.`
  }

  return null
}

export const diagnoseOversizedResult = (
  sql: string,
  rows: Array<Record<string, unknown>>,
  bytes: number
): Record<string, unknown> => ({
  error: 'RESULT_TOO_LARGE',
  rows_returned: rows.length,
  bytes_returned: bytes,
  columns: rows[0] ? Object.keys(rows[0]) : [],
  hint: 'Reduce scope: narrower dates, GROUP BY, fewer columns, or LIMIT. Do not invent rows.',
  your_sql: sql,
})

export const anchorDates = (sql: string, referenceDate: string): string =>
  sql
    .replace(/CURDATE\s*\(\s*\)/gi, `'${referenceDate}'`)
    .replace(/CURRENT_DATE\b/gi, `'${referenceDate}'::date`)

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const isUuid = (value: string): boolean => UUID_RE.test(value)

export const stripSqlComments = (sql: string): string =>
  sql.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/--[^\n]*/g, ' ')

export const stripLeadingSqlNoise = (sql: string): string => {
  let next = sql.trimStart()
  for (let i = 0; i < 32; i++) {
    if (next.startsWith('/*')) {
      const end = next.indexOf('*/')
      if (end < 0) break
      next = next.slice(end + 2).trimStart()
      continue
    }
    if (next.startsWith('--')) {
      const newline = next.indexOf('\n')
      if (newline < 0) return ''
      next = next.slice(newline + 1).trimStart()
      continue
    }
    break
  }
  return next
}

const isReferenceOnlyQuery = (sql: string): boolean => {
  const pattern = /\b(?:FROM|JOIN)\s+([a-zA-Z_][\w]*)/gi
  const tables: string[] = []
  let m: RegExpExecArray | null
  while ((m = pattern.exec(sql)) !== null) tables.push(m[1].toLowerCase())
  return tables.length > 0 && tables.every((t) => REFERENCE_TABLES.has(t))
}

const firstDisallowedPeriodMetric = (sql: string, clubId: string): string | null => {
  if (!/\bpm\.name\b|\bperiod_metrics\b/i.test(sql)) return null
  const names = new Set<string>()
  const eqRe = /\bpm\.name\s*=\s*'([^']+)'/gi
  let match: RegExpExecArray | null
  while ((match = eqRe.exec(sql)) !== null) names.add(match[1])
  const inRe = /\bpm\.name\s+IN\s*\(([^)]+)\)/gi
  while ((match = inRe.exec(sql)) !== null) {
    for (const part of match[1].split(',')) {
      const name = part.trim().replace(/^'|'$/g, '')
      if (name && !name.includes('%')) names.add(name)
    }
  }
  for (const name of names) {
    if (!isChatbotAllowedPeriodMetric(clubId, name)) return name
  }
  return null
}

const extractRawQueryRows = (result: unknown): Record<string, unknown>[] => {
  if (Array.isArray(result)) {
    if (result.length > 0 && Array.isArray(result[0])) {
      return result[0] as Record<string, unknown>[]
    }
    return result as Record<string, unknown>[]
  }
  if (
    result &&
    typeof result === 'object' &&
    'rows' in result &&
    Array.isArray((result as { rows: unknown }).rows)
  ) {
    return (result as { rows: Record<string, unknown>[] }).rows
  }
  return []
}

export type ClubPeriodMetricRow = { name: string; unit: string | null }

const PERIOD_CATALOGUE_UNIT_SQL = 'COALESCE(pmcu.unit, pm.unit) AS unit'

const mapClubPeriodMetricRows = (
  rows: Array<{ name?: unknown; unit?: unknown }>
): ClubPeriodMetricRow[] =>
  rows.map((row) => ({
    name: String(row.name),
    unit: row.unit != null ? String(row.unit) : null,
  }))

export const queryClubPeriodMetricsByWhitelist = async (
  clubId: string,
  startDate: string,
  endDate: string,
  whitelist: readonly string[]
): Promise<ClubPeriodMetricRow[]> => {
  const rows = await db
    .from('period_metrics as pm')
    .leftJoin('period_metric_club_units as pmcu', function () {
      this.on('pmcu.metric_id', '=', 'pm.id').andOnVal('pmcu.club_id', clubId)
    })
    .whereIn('pm.name', [...whitelist])
    .whereExists((sub) => {
      sub
        .from('period_metric_values as pmv')
        .join('periods as p', 'p.id', 'pmv.period_id')
        .join('sport_activities as sa', 'sa.id', 'p.sport_activity_id')
        .join('days as d', 'd.id', 'sa.day_id')
        .join('athletes as a', 'a.id', 'd.athlete_id')
        .whereColumn('pmv.metric_id', 'pm.id')
        .where('a.club_id', clubId)
        .whereBetween('d.date_of_day', [startDate, endDate])
        .select(1)
        .limit(1)
    })
    .orderBy('pm.name')
    .select('pm.name')
    .select(db.raw(PERIOD_CATALOGUE_UNIT_SQL))
  return mapClubPeriodMetricRows(rows)
}

export const queryClubPeriodMetricsInWindow = async (
  clubId: string,
  startDate: string,
  endDate: string,
  excludedNames: readonly string[] = CHATBOT_FILTERED_PERIOD_METRICS
): Promise<ClubPeriodMetricRow[]> => {
  const rows = await db
    .from('period_metrics as pm')
    .join('period_metric_values as pmv', 'pmv.metric_id', 'pm.id')
    .join('periods as p', 'p.id', 'pmv.period_id')
    .join('sport_activities as sa', 'sa.id', 'p.sport_activity_id')
    .join('days as d', 'd.id', 'sa.day_id')
    .join('athletes as a', 'a.id', 'd.athlete_id')
    .leftJoin('period_metric_club_units as pmcu', function () {
      this.on('pmcu.metric_id', '=', 'pm.id').andOnVal('pmcu.club_id', clubId)
    })
    .where('a.club_id', clubId)
    .whereBetween('d.date_of_day', [startDate, endDate])
    .whereNotIn('pm.name', [...excludedNames])
    .groupBy('pm.name', 'pmcu.unit', 'pm.unit')
    .orderBy('pm.name')
    .select('pm.name')
    .select(db.raw(PERIOD_CATALOGUE_UNIT_SQL))
  return mapClubPeriodMetricRows(rows)
}

export const queryPeriodMetricUnitsByNames = async (
  clubId: string,
  names: readonly string[]
): Promise<ClubPeriodMetricRow[]> => {
  const rows = await db
    .from('period_metrics as pm')
    .leftJoin('period_metric_club_units as pmcu', function () {
      this.on('pmcu.metric_id', '=', 'pm.id').andOnVal('pmcu.club_id', clubId)
    })
    .whereIn('pm.name', [...names])
    .orderBy('pm.name')
    .select('pm.name')
    .select(db.raw(PERIOD_CATALOGUE_UNIT_SQL))
  return mapClubPeriodMetricRows(rows)
}
