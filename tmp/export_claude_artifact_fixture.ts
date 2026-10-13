import 'reflect-metadata'
import { Ignitor } from '@adonisjs/core'
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

const APP_ROOT = new URL('../', import.meta.url)
const IMPORTER = (filePath: string) => {
  if (filePath.startsWith('./') || filePath.startsWith('../')) {
    return import(new URL(filePath, APP_ROOT).href)
  }
  return import(filePath)
}

const CAESAR_SHIFT = 3
const CLUB_ID = process.env.ARTIFACT_CLUB_ID ?? '019fa7cc-684c-783e-9609-c132a26eb4e3'
const DAYS_BACK = Number(process.env.ARTIFACT_DAYS_BACK ?? 90)
const LONG_DAYS_BACK = Number(process.env.ARTIFACT_LONG_DAYS_BACK ?? 180)

const caesarChar = (ch: string, shift: number): string => {
  const code = ch.charCodeAt(0)
  if (code >= 65 && code <= 90) return String.fromCharCode(((code - 65 + shift) % 26) + 65)
  if (code >= 97 && code <= 122) return String.fromCharCode(((code - 97 + shift) % 26) + 97)
  return ch
}

const caesarName = (value: string, shift = CAESAR_SHIFT): string => {
  const folded = value
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
  return [...folded].map((ch) => caesarChar(ch, shift)).join('')
}

const isoToday = (): string => new Date().toISOString().slice(0, 10)

const isoDaysAgo = (days: number): string => {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() - days)
  return d.toISOString().slice(0, 10)
}

const serializeCell = (value: unknown): unknown => {
  if (value == null) return null
  if (value instanceof Date) return value.toISOString().slice(0, 10)
  if (typeof value === 'bigint') return Number(value)
  if (typeof value === 'object' && value !== null && 'toISODate' in value) {
    return (value as { toISODate: () => string | null }).toISODate()
  }
  return value
}

const anonymizeRow = (
  row: Record<string, unknown>,
  nameMap: Map<string, string>
): Record<string, unknown> => {
  const next: Record<string, unknown> = {}
  for (const [key, raw] of Object.entries(row)) {
    const value = serializeCell(raw)
    if (
      (key === 'joueur' || key === 'name' || key === 'athlete' || key === 'player') &&
      typeof value === 'string' &&
      value.trim()
    ) {
      const original = value.trim()
      let ciphered = nameMap.get(original)
      if (!ciphered) {
        ciphered = caesarName(original)
        nameMap.set(original, ciphered)
      }
      next[key] = ciphered
      next.player_key = ciphered.replace(/\s+/g, '_').toLowerCase()
      continue
    }
    if (key === 'athlete_id' || key === 'id') continue
    next[key] = value
  }
  return next
}

const ignitor = new Ignitor(APP_ROOT, { importer: IMPORTER })
const app = ignitor.createApp('console')
await app.init()
await app.boot()

const db = (await import('@adonisjs/lucid/services/db')).default
const {
  PREMIUM_SQL_TEMPLATE,
  buildPremiumSqlTemplate,
} = await import('#services/premium_report/premium_report_sql_templates')
type PremiumSqlTemplateId =
  (typeof PREMIUM_SQL_TEMPLATE)[keyof typeof PREMIUM_SQL_TEMPLATE]

const from = isoDaysAgo(DAYS_BACK)
const to = isoToday()
const fromLong = isoDaysAgo(LONG_DAYS_BACK)

const nameMap = new Map<string, string>()

const runSql = async (sql: string): Promise<Record<string, unknown>[]> => {
  const result = await db.rawQuery(sql)
  const rows = (result.rows ?? result[0] ?? []) as Record<string, unknown>[]
  return rows.map((row) => anonymizeRow(row, nameMap))
}

const NUMERIC_RE = "'^-*[0-9]+([.][0-9]+)*$'"

const rosterSql = `
SELECT
  TRIM(a.first_name) || ' ' || TRIM(a.last_name) AS joueur,
  COALESCE(pp.name, '') AS position,
  a.jersey_number,
  a.gender,
  ROUND(a.height_cm::numeric, 1) AS height_cm,
  ROUND(a.weight_kg::numeric, 1) AS weight_kg,
  ROUND(a.fat_percentage::numeric, 1) AS fat_percentage,
  a.start_date::date AS start_date,
  a.end_date::date AS end_date
FROM athletes a
LEFT JOIN player_positions pp ON pp.id = a.player_position_id
WHERE a.club_id = '${CLUB_ID}'
ORDER BY joueur
`.trim()

const wellnessSql = `
SELECT
  TRIM(a.first_name) || ' ' || TRIM(a.last_name) AS joueur,
  d.date_of_day,
  hr.energy_rating,
  hr.mood_rating,
  hr.stress_rating,
  hr.wellbeing_rating,
  hr.body_soreness_rating
FROM health_ratings hr
JOIN days d ON d.id = hr.day_id
JOIN athletes a ON a.id = d.athlete_id
WHERE a.club_id = '${CLUB_ID}'
  AND d.date_of_day BETWEEN '${from}' AND '${to}'
ORDER BY d.date_of_day, joueur
`.trim()

const sleepSql = `
SELECT
  TRIM(a.first_name) || ' ' || TRIM(a.last_name) AS joueur,
  d.date_of_day,
  s.quality_rating,
  ROUND(s.sleep_efficiency_percentage::numeric, 1) AS sleep_efficiency_pct,
  ROUND(s.sleep_consistency_percentage::numeric, 1) AS sleep_consistency_pct,
  ROUND((s.total_in_bed_time_milli::numeric / 3600000.0), 2) AS hours_in_bed,
  ROUND((s.total_awake_time_milli::numeric / 3600000.0), 2) AS hours_awake,
  ROUND((s.total_rem_sleep_time_milli::numeric / 3600000.0), 2) AS hours_rem,
  ROUND((s.total_slow_wave_sleep_time_milli::numeric / 3600000.0), 2) AS hours_slow_wave,
  s.data_source
FROM sleeps s
JOIN days d ON d.id = s.day_id
JOIN athletes a ON a.id = d.athlete_id
WHERE a.club_id = '${CLUB_ID}'
  AND d.date_of_day BETWEEN '${from}' AND '${to}'
ORDER BY d.date_of_day, joueur
`.trim()

const sleepMetricsSql = `
SELECT
  TRIM(a.first_name) || ' ' || TRIM(a.last_name) AS joueur,
  d.date_of_day,
  sm.name AS metric,
  ROUND(AVG(CASE WHEN NULLIF(TRIM(smv.value), '') ~ ${NUMERIC_RE}
    THEN CAST(TRIM(smv.value) AS DECIMAL) END)::numeric, 2) AS value
FROM sleep_metric_values smv
JOIN sleep_metrics sm ON sm.id = smv.metric_id
JOIN sleeps s ON s.id = smv.sleep_id
JOIN days d ON d.id = s.day_id
JOIN athletes a ON a.id = d.athlete_id
WHERE a.club_id = '${CLUB_ID}'
  AND d.date_of_day BETWEEN '${from}' AND '${to}'
GROUP BY a.id, a.first_name, a.last_name, d.date_of_day, sm.name
HAVING AVG(CASE WHEN NULLIF(TRIM(smv.value), '') ~ ${NUMERIC_RE}
  THEN CAST(TRIM(smv.value) AS DECIMAL) END) IS NOT NULL
ORDER BY d.date_of_day, joueur, metric
`.trim()

const biomarkersRawSql = `
SELECT
  TRIM(a.first_name) || ' ' || TRIM(a.last_name) AS joueur,
  (b.measured_at AT TIME ZONE 'UTC')::date AS date_of_day,
  bt.name AS biomarker,
  ROUND(AVG(CASE WHEN NULLIF(TRIM(b.value), '') ~ ${NUMERIC_RE}
    THEN CAST(TRIM(b.value) AS DECIMAL) END)::numeric, 2) AS value
FROM biomarkers b
JOIN biomarker_types bt ON bt.id = b.biomarker_type_id
JOIN athletes a ON a.id = b.athlete_id
WHERE a.club_id = '${CLUB_ID}'
  AND (b.measured_at AT TIME ZONE 'UTC')::date BETWEEN '${fromLong}' AND '${to}'
GROUP BY a.id, a.first_name, a.last_name, (b.measured_at AT TIME ZONE 'UTC')::date, bt.name
HAVING AVG(CASE WHEN NULLIF(TRIM(b.value), '') ~ ${NUMERIC_RE}
  THEN CAST(TRIM(b.value) AS DECIMAL) END) IS NOT NULL
ORDER BY date_of_day, biomarker, joueur
`.trim()

const gpsIntensitySql = `
SELECT
  TRIM(a.first_name) || ' ' || TRIM(a.last_name) AS joueur,
  d.date_of_day,
  pm.name AS metric,
  ROUND(AVG(CASE WHEN NULLIF(TRIM(pmv.value), '') ~ ${NUMERIC_RE}
    THEN CAST(TRIM(pmv.value) AS DECIMAL) END)::numeric, 2) AS value
FROM period_metric_values pmv
JOIN period_metrics pm ON pm.id = pmv.metric_id
JOIN periods p ON p.id = pmv.period_id
JOIN sport_activities sa ON sa.id = p.sport_activity_id
JOIN days d ON d.id = sa.day_id
JOIN athletes a ON a.id = d.athlete_id
WHERE a.club_id = '${CLUB_ID}'
  AND d.date_of_day BETWEEN '${from}' AND '${to}'
GROUP BY a.id, a.first_name, a.last_name, d.date_of_day, pm.name
HAVING AVG(CASE WHEN NULLIF(TRIM(pmv.value), '') ~ ${NUMERIC_RE}
  THEN CAST(TRIM(pmv.value) AS DECIMAL) END) IS NOT NULL
ORDER BY d.date_of_day, joueur, metric
LIMIT 50000
`.trim()

const templateJobs: Array<{
  domain: string
  templateId: PremiumSqlTemplateId
  from: string
  to: string
}> = [
  { domain: 'scores', templateId: PREMIUM_SQL_TEMPLATE.DAILY_SCORES, from, to },
  { domain: 'load_srpe', templateId: PREMIUM_SQL_TEMPLATE.DAILY_SRPE, from, to },
  { domain: 'gps_distance', templateId: PREMIUM_SQL_TEMPLATE.GPS_DISTANCE, from, to },
  { domain: 'gps_intensity_daily', templateId: PREMIUM_SQL_TEMPLATE.GPS_INTENSITY_DAILY, from, to },
  { domain: 'match_stats_daily', templateId: PREMIUM_SQL_TEMPLATE.MATCH_STATS_DAILY, from, to },
  { domain: 'biomarkers_daily', templateId: PREMIUM_SQL_TEMPLATE.BIOMARKERS_DAILY, from: fromLong, to },
  { domain: 'vald_tests', templateId: PREMIUM_SQL_TEMPLATE.VALD_TESTS, from: fromLong, to },
  { domain: 'body', templateId: PREMIUM_SQL_TEMPLATE.BODY_METRICS, from: fromLong, to },
  { domain: 'injury', templateId: PREMIUM_SQL_TEMPLATE.INJURIES, from: fromLong, to },
]

const clubRow = await db.rawQuery(`SELECT id, name FROM clubs WHERE id = ?`, [CLUB_ID])
const clubName = String(clubRow.rows?.[0]?.name ?? 'Club')

const domains: Record<string, { rows: Record<string, unknown>[]; rowCount: number }> = {}

console.log(`Export club=${clubName} window=${from}→${to} long=${fromLong}→${to}`)

const roster = await runSql(rosterSql)
domains.roster = { rows: roster, rowCount: roster.length }
console.log(`roster ${roster.length}`)

const wellness = await runSql(wellnessSql)
domains.wellness = { rows: wellness, rowCount: wellness.length }
console.log(`wellness ${wellness.length}`)

try {
  const sleep = await runSql(sleepSql)
  domains.sleep = { rows: sleep, rowCount: sleep.length }
  console.log(`sleep ${sleep.length}`)
} catch (error) {
  console.warn('sleep export skipped', error instanceof Error ? error.message : error)
  domains.sleep = { rows: [], rowCount: 0 }
}

try {
  const sleepMetrics = await runSql(sleepMetricsSql)
  domains.sleep_metrics = { rows: sleepMetrics, rowCount: sleepMetrics.length }
  console.log(`sleep_metrics ${sleepMetrics.length}`)
} catch (error) {
  console.warn('sleep_metrics skipped', error instanceof Error ? error.message : error)
  domains.sleep_metrics = { rows: [], rowCount: 0 }
}

try {
  const biomarkersRaw = await runSql(biomarkersRawSql)
  domains.biomarkers_raw = { rows: biomarkersRaw, rowCount: biomarkersRaw.length }
  console.log(`biomarkers_raw ${biomarkersRaw.length}`)
} catch (error) {
  console.warn('biomarkers_raw skipped', error instanceof Error ? error.message : error)
  domains.biomarkers_raw = { rows: [], rowCount: 0 }
}

try {
  const gpsMetrics = await runSql(gpsIntensitySql)
  domains.gps_period_metrics = { rows: gpsMetrics, rowCount: gpsMetrics.length }
  console.log(`gps_period_metrics ${gpsMetrics.length}`)
} catch (error) {
  console.warn('gps_period_metrics skipped', error instanceof Error ? error.message : error)
  domains.gps_period_metrics = { rows: [], rowCount: 0 }
}

for (const job of templateJobs) {
  const sql = await buildPremiumSqlTemplate(job.templateId, {
    clubId: CLUB_ID,
    from: job.from,
    to: job.to,
  })
  const rows = await runSql(sql)
  domains[job.domain] = { rows, rowCount: rows.length }
  console.log(`${job.domain} ${rows.length}`)
}

const payload = {
  meta: {
    purpose: 'Claude Artifact fixture — multi-domain staff report test data',
    generatedAt: new Date().toISOString(),
    clubLabel: caesarName(clubName),
    dateRange: { from, to },
    longRange: { from: fromLong, to },
    caesarShift: CAESAR_SHIFT,
    note: 'Player names Caesar-shifted (accents stripped). Real athlete ids omitted. Club label also ciphered.',
    domains: Object.keys(domains),
    playerCount: roster.length,
    totalRows: Object.values(domains).reduce((sum, d) => sum + d.rowCount, 0),
  },
  nameCipherSample: [...nameMap.entries()].slice(0, 8).map(([fromName, toName]) => ({
    fromLength: fromName.length,
    to: toName,
  })),
  domains,
}

const outDir = join(process.cwd(), 'tmp')
await mkdir(outDir, { recursive: true })
const outPath = join(outDir, `claude-artifact-fixture-${to}.json`)
await writeFile(outPath, JSON.stringify(payload, null, 2), 'utf8')

const bytes = Buffer.byteLength(JSON.stringify(payload))
console.log(
  JSON.stringify(
    {
      outPath,
      bytes,
      mb: Number((bytes / 1024 / 1024).toFixed(2)),
      players: roster.length,
      totalRows: payload.meta.totalRows,
      domains: Object.fromEntries(
        Object.entries(domains).map(([k, v]) => [k, v.rowCount])
      ),
    },
    null,
    2
  )
)

await app.terminate()
process.exit(0)
