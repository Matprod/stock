import db from '@adonisjs/lucid/services/db'
import { clubMetricCatalog } from '#services/premium_report/club_metric_catalog'
import {
  PREMIUM_SQL_TEMPLATE,
  type PremiumSqlTemplateId,
} from '#services/premium_report/premium_report_sql_templates'

export type PremiumColumnMeta = {
  units: Record<string, string>
  labels: Record<string, string>
}

const emptyMeta = (): PremiumColumnMeta => ({ units: {}, labels: {} })

const pickDisplayName = (row: { display_name?: unknown; displayName?: unknown }): string => {
  const raw = row.display_name ?? row.displayName
  return raw != null ? String(raw).trim() : ''
}

export const loadPeriodMetricMeta = async (
  clubId: string,
  metricNames: string[]
): Promise<Record<string, { unit: string; label: string }>> => {
  const names = [...new Set(metricNames.filter(Boolean))]
  if (names.length === 0) return {}

  const rows = await db
    .from('period_metrics as pm')
    .leftJoin('period_metric_club_units as pmcu', function () {
      this.on('pmcu.metric_id', '=', 'pm.id').andOnVal('pmcu.club_id', clubId)
    })
    .whereIn('pm.name', names)
    .select('pm.name', 'pm.display_name')
    .select(db.raw('COALESCE(pmcu.unit, pm.unit) AS unit'))

  const out: Record<string, { unit: string; label: string }> = {}
  for (const row of rows) {
    const name = String(row.name ?? '')
    if (!name) continue
    out[name] = {
      unit: row.unit != null ? String(row.unit).trim() : '',
      label: pickDisplayName(row),
    }
  }
  return out
}

export const loadSportActivityMetricMeta = async (
  metricNames: string[]
): Promise<Record<string, { unit: string; label: string }>> => {
  const names = [...new Set(metricNames.filter(Boolean))]
  if (names.length === 0) return {}

  const rows = await db
    .from('sport_activity_metrics as sam')
    .whereIn('sam.name', names)
    .select('sam.name', 'sam.display_name', 'sam.unit')

  const out: Record<string, { unit: string; label: string }> = {}
  for (const row of rows) {
    const name = String(row.name ?? '')
    if (!name) continue
    out[name] = {
      unit: row.unit != null ? String(row.unit).trim() : '',
      label: pickDisplayName(row),
    }
  }
  return out
}

export const loadPeriodMetricUnits = async (
  clubId: string,
  metricNames: string[]
): Promise<Record<string, string>> => {
  const meta = await loadPeriodMetricMeta(clubId, metricNames)
  const out: Record<string, string> = {}
  for (const [name, value] of Object.entries(meta)) {
    if (value.unit) out[name] = value.unit
  }
  return out
}

export const loadSportActivityMetricUnits = async (
  metricNames: string[]
): Promise<Record<string, string>> => {
  const meta = await loadSportActivityMetricMeta(metricNames)
  const out: Record<string, string> = {}
  for (const [name, value] of Object.entries(meta)) {
    if (value.unit) out[name] = value.unit
  }
  return out
}

const writeMeta = (
  meta: PremiumColumnMeta,
  key: string,
  entry: { unit: string; label: string }
) => {
  if (!key) return
  if (entry.unit && !meta.units[key]) meta.units[key] = entry.unit
  if (entry.label && !meta.labels[key]) meta.labels[key] = entry.label
}

const applyKpiMeta = (
  byName: Record<string, { unit: string; label: string }>,
  kpis: Array<{ name: string; alias: string }>
): PremiumColumnMeta => {
  const meta = emptyMeta()
  for (const kpi of kpis) {
    const entry = byName[kpi.name]
    if (!entry) continue
    writeMeta(meta, kpi.alias, entry)
    writeMeta(meta, kpi.name, entry)
    writeMeta(meta, kpi.name.toLowerCase(), entry)
  }
  return meta
}

const metaByLowerName = async (
  table: 'period_metrics' | 'sport_activity_metrics',
  clubId: string,
  lowered: string[]
): Promise<Map<string, { unit: string; label: string }>> => {
  const out = new Map<string, { unit: string; label: string }>()
  if (lowered.length === 0) return out
  const placeholders = lowered.map(() => '?').join(',')
  const query =
    table === 'period_metrics'
      ? db
          .from('period_metrics as pm')
          .leftJoin('period_metric_club_units as pmcu', function () {
            this.on('pmcu.metric_id', '=', 'pm.id').andOnVal('pmcu.club_id', clubId)
          })
          .whereRaw(`LOWER(pm.name) IN (${placeholders})`, lowered)
          .select('pm.name', 'pm.display_name')
          .select(db.raw('COALESCE(pmcu.unit, pm.unit) AS unit'))
      : db
          .from('sport_activity_metrics as sam')
          .whereRaw(`LOWER(sam.name) IN (${placeholders})`, lowered)
          .select('sam.name', 'sam.display_name', 'sam.unit')

  const rows = await query
  for (const row of rows) {
    const name = String(row.name ?? '')
      .trim()
      .toLowerCase()
    if (!name) continue
    out.set(name, {
      unit: row.unit != null ? String(row.unit).trim() : '',
      label: pickDisplayName(row),
    })
  }
  return out
}

export const columnMetaForNames = async (
  clubId: string,
  columns: string[]
): Promise<PremiumColumnMeta> => {
  const keys = [...new Set(columns.map((column) => column.trim()).filter(Boolean))]
  const lowered = [...new Set(keys.map((column) => column.toLowerCase()))]
  const [period, sport] = await Promise.all([
    metaByLowerName('period_metrics', clubId, lowered),
    metaByLowerName('sport_activity_metrics', clubId, lowered),
  ])
  const meta = emptyMeta()
  for (const column of keys) {
    const entry = period.get(column.toLowerCase()) ?? sport.get(column.toLowerCase())
    if (!entry) continue
    writeMeta(meta, column, entry)
    writeMeta(meta, column.toLowerCase(), entry)
  }
  return meta
}

export const applyColumnMeta = (
  dataset: { units?: Record<string, string>; labels?: Record<string, string> },
  meta: PremiumColumnMeta
) => {
  for (const [key, unit] of Object.entries(meta.units)) {
    if (!unit) continue
    dataset.units ??= {}
    if (!dataset.units[key]) dataset.units[key] = unit
  }
  for (const [key, label] of Object.entries(meta.labels)) {
    if (!label) continue
    dataset.labels ??= {}
    if (!dataset.labels[key]) dataset.labels[key] = label
  }
}

export const resolveTemplateColumnMeta = async (
  clubId: string,
  templateId: PremiumSqlTemplateId
): Promise<PremiumColumnMeta> => {
  if (
    templateId === PREMIUM_SQL_TEMPLATE.GPS_INTENSITY ||
    templateId === PREMIUM_SQL_TEMPLATE.GPS_INTENSITY_DAILY
  ) {
    const catalog = await clubMetricCatalog(clubId)
    const kpis = catalog.periodKpis
    const byName = await loadPeriodMetricMeta(
      clubId,
      kpis.map((k) => k.name)
    )
    return applyKpiMeta(byName, kpis)
  }

  if (templateId === PREMIUM_SQL_TEMPLATE.GPS_DISTANCE) {
    const catalog = await clubMetricCatalog(clubId)
    const distanceAliases = catalog.namesByUnit('distance')
    const durationAliases = catalog.namesByUnit('duration')
    const byName = await loadPeriodMetricMeta(clubId, [...distanceAliases, ...durationAliases])
    const meta = emptyMeta()
    const distance = distanceAliases
      .map((name) => byName[name])
      .find((e) => e && (e.unit || e.label))
    const duration = durationAliases
      .map((name) => byName[name])
      .find((e) => e && (e.unit || e.label))
    if (distance?.unit) {
      meta.units.distance_m = distance.unit
      meta.units.total_distance_m = distance.unit
    }
    if (distance?.label) {
      meta.labels.distance_m = distance.label
      meta.labels.total_distance_m = distance.label
    }
    if (duration?.unit) meta.units.total_minutes = duration.unit === 's' ? 'min' : duration.unit
    if (duration?.label) meta.labels.total_minutes = duration.label
    return meta
  }

  if (
    templateId === PREMIUM_SQL_TEMPLATE.MATCH_STATS ||
    templateId === PREMIUM_SQL_TEMPLATE.MATCH_STATS_DAILY
  ) {
    const catalog = await clubMetricCatalog(clubId)
    const byName = await loadSportActivityMetricMeta(catalog.matchNames)
    return applyKpiMeta(byName, catalog.matchKpis)
  }

  if (templateId === PREMIUM_SQL_TEMPLATE.DAILY_SCORES) {
    const meta = emptyMeta()
    meta.units.performance_score = '0-100'
    meta.units.injury_risk_score = '0-100'
    meta.labels.performance_score = 'Performance score'
    meta.labels.injury_risk_score = 'Injury risk score'
    return meta
  }

  return emptyMeta()
}
