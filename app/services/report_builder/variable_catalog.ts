import { METRIC_AGGREGATION_METHOD, METRIC_DATA_TYPE } from '#constants/metrics.constants'
import type { MetricAggregationMethod } from '#constants/metrics.constants'
import { filterChatbotPeriodMetricNames } from '#constants/chatbot.constants'
import {
  DERIVED_REPORT_COLUMNS,
  HEALTH_REPORT_COLUMNS,
  REPORT_CATALOG_GROUP,
  REPORT_VARIABLE_PREFIX,
  REPORT_VARIABLE_PREFIXES,
  SLEEP_REPORT_COLUMNS,
  SPORT_ACTIVITY_REPORT_COLUMNS,
  SUBJECTIVE_DOMAIN_TO_PREFIX,
  TIME_SERIES_REPORT_COLUMNS,
  type ReportCatalogGroup,
  type ReportColumnDefinition,
  type ReportVariablePrefix,
} from '#constants/report_builder.constants'
import {
  buildValdVariableField,
  orderedValdMetricsForTestType,
  parseValdVariableField,
  VALD_TRIAL_METRIC_KEYS,
  type ValdTrialMetricKey,
  valdMetricUnit,
} from '#constants/vald_metrics.constants'
import type {
  ReportCatalog,
  ReportDateRange,
  ReportVariableDefinition,
} from '#contracts/report_builder'
import HealthMetric from '#models_pg/health_metric'
import BiomarkerType from '#models_pg/biomarker_type'
import DayMetric from '#models_pg/day_metric'
import Insight from '#models_pg/insight'
import PeriodMetric from '#models_pg/period_metric'
import SleepMetric from '#models_pg/sleep_metric'
import { displayUnit, periodMetricValuesTable } from '#services/report_builder/report_units'
import { SubjectiveScaleService } from '#services/subjective_scale_service'
import type { AppLanguage } from '#utils/localize'
import string from '@adonisjs/core/helpers/string'
import db from '@adonisjs/lucid/services/db'

const NUMERIC_DATA_TYPES: string[] = [METRIC_DATA_TYPE.FLOAT, METRIC_DATA_TYPE.INTEGER]

export const buildVariableKey = (prefix: ReportVariablePrefix, field: string): string =>
  `${prefix}:${field}`

const COLUMN_DEFINITIONS: Record<
  'sportActivity' | 'health' | 'sleep',
  { prefix: ReportVariablePrefix; group: ReportCatalogGroup; columns: ReportColumnDefinition[] }
> = {
  sportActivity: {
    prefix: REPORT_VARIABLE_PREFIX.SPORT_ACTIVITY,
    group: REPORT_CATALOG_GROUP.SPORT_ACTIVITY,
    columns: SPORT_ACTIVITY_REPORT_COLUMNS,
  },
  health: {
    prefix: REPORT_VARIABLE_PREFIX.HEALTH,
    group: REPORT_CATALOG_GROUP.HEALTH,
    columns: HEALTH_REPORT_COLUMNS,
  },
  sleep: {
    prefix: REPORT_VARIABLE_PREFIX.SLEEP,
    group: REPORT_CATALOG_GROUP.SLEEP,
    columns: SLEEP_REPORT_COLUMNS,
  },
}

const columnDefinitionByKey = (() => {
  const map = new Map<string, ReportVariableDefinition>()
  for (const { prefix, group, columns } of Object.values(COLUMN_DEFINITIONS)) {
    for (const column of columns) {
      const key = buildVariableKey(prefix, column.field)
      map.set(key, {
        key,
        prefix,
        field: column.field,
        group,
        name: column.name,
        description: column.description,
        unit: column.unit,
        aggregation: column.aggregation,
      })
    }
  }
  return map
})()

const timeSeriesDefinitionByKey = (() => {
  const map = new Map<string, ReportVariableDefinition>()
  for (const column of TIME_SERIES_REPORT_COLUMNS) {
    const key = buildVariableKey(REPORT_VARIABLE_PREFIX.TIME_SERIES, column.field)
    map.set(key, {
      key,
      prefix: REPORT_VARIABLE_PREFIX.TIME_SERIES,
      field: column.field,
      group: REPORT_CATALOG_GROUP.TIME_SERIES,
      name: column.name,
      description: column.description,
      unit: column.unit,
      aggregation: column.aggregation,
    })
  }
  return map
})()

const derivedDefinitionByKey = (() => {
  const map = new Map<string, ReportVariableDefinition>()
  for (const column of DERIVED_REPORT_COLUMNS) {
    const key = buildVariableKey(REPORT_VARIABLE_PREFIX.DERIVED, column.field)
    map.set(key, {
      key,
      prefix: REPORT_VARIABLE_PREFIX.DERIVED,
      field: column.field,
      group: REPORT_CATALOG_GROUP.DERIVED,
      name: column.name,
      description: column.description,
      unit: column.unit,
      aggregation: column.aggregation,
    })
  }
  return map
})()

export const parseVariableKey = (
  key: string
): { prefix: ReportVariablePrefix; field: string } | null => {
  const separator = key.indexOf(':')
  if (separator <= 0) return null
  const prefix = key.slice(0, separator)
  const field = key.slice(separator + 1)
  if (!field || !isReportVariablePrefix(prefix)) return null
  return { prefix, field }
}

const isReportVariablePrefix = (value: string): value is ReportVariablePrefix =>
  REPORT_VARIABLE_PREFIXES.includes(value as ReportVariablePrefix)

type EavMetricRow = {
  name: string
  displayName?: string | null
  description?: string | null
  unit: string | null
  aggregationMethod?: MetricAggregationMethod | null
}

const eavMetricLabel = (row: EavMetricRow): string =>
  row.displayName?.trim() || row.description?.trim() || row.name.replaceAll('_', ' ')

const dayMetricLabel = (row: { name: string; description?: string | null }): string => {
  const description = row.description?.trim()
  if (description) {
    const beforeColon = description.split(':')[0]?.trim()
    if (beforeColon) return beforeColon
  }
  return row.name.replaceAll('_', ' ')
}

const toColumnEntries = (): ReportVariableDefinition[] => [...columnDefinitionByKey.values()]

const loadClubDerived = async (
  clubId: string,
  dateRange?: ReportDateRange
): Promise<ReportVariableDefinition[]> => {
  const daysQuery = db
    .from('days as d')
    .join('athletes as a', 'a.id', 'd.athlete_id')
    .where('a.club_id', clubId)
    .select(
      db.raw('COUNT(*) FILTER (WHERE d.performance_score IS NOT NULL) as performance_score'),
      db.raw('COUNT(*) FILTER (WHERE d.injury_risk_score IS NOT NULL) as injury_risk_score')
    )

  const overlappingInjuriesQuery = db
    .from('injuries as i')
    .join('athletes as a', 'a.id', 'i.athlete_id')
    .where('a.club_id', clubId)
    .whereNotNull('i.date_of_injury')

  const newInjuriesQuery = db
    .from('injuries as i')
    .join('athletes as a', 'a.id', 'i.athlete_id')
    .where('a.club_id', clubId)
    .whereNotNull('i.date_of_injury')

  if (dateRange) {
    daysQuery.whereBetween('d.date_of_day', [dateRange.from, dateRange.to])
    overlappingInjuriesQuery.where('i.date_of_injury', '<=', dateRange.to).where((query) => {
      query.whereNull('i.recovery_date').orWhere('i.recovery_date', '>=', dateRange.from)
    })
    newInjuriesQuery.whereBetween('i.date_of_injury', [dateRange.from, dateRange.to])
  }

  const [scoreRow, overlappingInjuryCount, newInjuryCount] = await Promise.all([
    daysQuery.first() as Promise<Record<string, string | number | bigint | null> | null>,
    overlappingInjuriesQuery.count('* as total').first() as Promise<{
      total: string | number
    } | null>,
    newInjuriesQuery.count('* as total').first() as Promise<{ total: string | number } | null>,
  ])

  const populated = new Set<string>()
  if (Number(scoreRow?.performance_score ?? 0) > 0) populated.add('performanceScore')
  if (Number(scoreRow?.injury_risk_score ?? 0) > 0) populated.add('injuryRiskScore')
  if (Number(newInjuryCount?.total ?? 0) > 0) populated.add('newInjuries')
  if (Number(overlappingInjuryCount?.total ?? 0) > 0) {
    populated.add('injuryDays')
    populated.add('injuryLog')
  }

  return DERIVED_REPORT_COLUMNS.filter((column) => populated.has(column.field)).map((column) => {
    const key = buildVariableKey(REPORT_VARIABLE_PREFIX.DERIVED, column.field)
    return (
      derivedDefinitionByKey.get(key) ?? {
        key,
        prefix: REPORT_VARIABLE_PREFIX.DERIVED,
        field: column.field,
        group: REPORT_CATALOG_GROUP.DERIVED,
        name: column.name,
        description: column.description,
        unit: column.unit,
        aggregation: column.aggregation,
      }
    )
  })
}
const TIME_SERIES_SKIP_TYPES = new Set(['LATITUDE', 'LONGITUDE'])

const timeSeriesDefinitionForType = (type: string): ReportVariableDefinition | null => {
  if (TIME_SERIES_SKIP_TYPES.has(type)) return null
  const known = timeSeriesDefinitionByKey.get(
    buildVariableKey(REPORT_VARIABLE_PREFIX.TIME_SERIES, type)
  )
  if (known) return known
  const label = type.replaceAll('_', ' ').toLowerCase()
  const name = `${label.charAt(0).toUpperCase()}${label.slice(1)} (series)`
  return {
    key: buildVariableKey(REPORT_VARIABLE_PREFIX.TIME_SERIES, type),
    prefix: REPORT_VARIABLE_PREFIX.TIME_SERIES,
    field: type,
    group: REPORT_CATALOG_GROUP.TIME_SERIES,
    name,
    description: `Intra-session ${label}`,
    unit: null,
    aggregation: METRIC_AGGREGATION_METHOD.AVERAGE,
  }
}

const loadClubTimeSeries = async (
  clubId: string,
  dateRange?: ReportDateRange
): Promise<ReportVariableDefinition[]> => {
  const query = db
    .from('series as s')
    .join('periods as p', 'p.id', 's.period_id')
    .join('sport_activities as sa', 'sa.id', 'p.sport_activity_id')
    .join('days as d', 'd.id', 'sa.day_id')
    .join('athletes as a', 'a.id', 'd.athlete_id')
    .where('a.club_id', clubId)
    .whereNotNull('s.data_encoded')
    .whereNot('s.data_encoded', '')
    .distinct('s.type')
    .orderBy('s.type')
    .select('s.type')

  if (dateRange) {
    query.whereBetween('d.date_of_day', [dateRange.from, dateRange.to])
  }

  const rows = (await query) as Array<{ type: string }>
  return rows
    .map((row) => timeSeriesDefinitionForType(String(row.type)))
    .filter((entry): entry is ReportVariableDefinition => entry !== null)
}

const sqlColumnForField = (field: string): string => {
  if (field === 'durationHours') return 'total_in_bed_time_milli'
  return string.snakeCase(field)
}

const loadPopulatedColumnFields = async (args: {
  table: string
  alias: string
  dayForeignKey: string
  fields: string[]
  clubId: string
  dateRange?: ReportDateRange
}): Promise<Set<string>> => {
  if (args.fields.length === 0) return new Set()

  const query = db
    .from(`${args.table} as ${args.alias}`)
    .join('days as d', 'd.id', args.dayForeignKey)
    .join('athletes as a', 'a.id', 'd.athlete_id')
    .where('a.club_id', args.clubId)

  if (args.dateRange) {
    query.whereBetween('d.date_of_day', [args.dateRange.from, args.dateRange.to])
  }

  query.select(
    ...args.fields.map((field) => {
      const sqlColumn = sqlColumnForField(field)
      const countAlias = string.snakeCase(field)
      return db.raw(
        `COUNT(*) FILTER (WHERE ${args.alias}.${sqlColumn} IS NOT NULL AND ${args.alias}.${sqlColumn} <> 0) as ${countAlias}`
      )
    })
  )

  const row = (await query.first()) as Record<string, string | number | bigint | null> | null
  if (!row) return new Set()

  const populated = new Set<string>()
  for (const field of args.fields) {
    const count = Number(row[string.snakeCase(field)] ?? 0)
    if (count > 0) populated.add(field)
  }
  return populated
}

const toEavDefinition = (
  prefix: ReportVariablePrefix,
  group: ReportCatalogGroup,
  row: EavMetricRow,
  fallbackAggregation: MetricAggregationMethod
): ReportVariableDefinition => {
  const key = buildVariableKey(prefix, row.name)
  const label = eavMetricLabel(row)
  return {
    key,
    prefix,
    field: row.name,
    group,
    name: label,
    description: row.description?.trim() || label,
    unit: displayUnit(row.name, row.unit),
    aggregation: row.aggregationMethod ?? fallbackAggregation,
  }
}

const normalizeMetricLabel = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, '')

const registerEavDefinitions = (
  resolved: Map<string, ReportVariableDefinition>,
  prefix: ReportVariablePrefix,
  group: ReportCatalogGroup,
  requestedFields: string[],
  metrics: Array<{
    name: string
    displayName?: string | null
    description?: string | null
    unit?: string | null
    aggregationMethod?: MetricAggregationMethod | null
  }>,
  fallbackAggregation: MetricAggregationMethod
) => {
  for (const metric of metrics) {
    const definition = toEavDefinition(
      prefix,
      group,
      {
        name: metric.name,
        displayName: metric.displayName,
        description: metric.description,
        unit: metric.unit ?? null,
        aggregationMethod: metric.aggregationMethod ?? undefined,
      },
      fallbackAggregation
    )
    resolved.set(definition.key, definition)
  }

  for (const requested of requestedFields) {
    const requestedKey = buildVariableKey(prefix, requested)
    if (resolved.has(requestedKey)) continue
    const needle = normalizeMetricLabel(requested)
    const metric = metrics.find(
      (row) =>
        normalizeMetricLabel(row.name) === needle ||
        (row.displayName != null && normalizeMetricLabel(row.displayName) === needle)
    )
    if (!metric) continue
    const canonical = toEavDefinition(
      prefix,
      group,
      {
        name: metric.name,
        displayName: metric.displayName,
        description: metric.description,
        unit: metric.unit ?? null,
        aggregationMethod: metric.aggregationMethod ?? undefined,
      },
      fallbackAggregation
    )
    resolved.set(requestedKey, { ...canonical, key: requestedKey })
  }
}

const distinctClubMetricNames = async (
  query: ReturnType<typeof db.from>,
  dateRange?: ReportDateRange
): Promise<string[]> => {
  if (dateRange) {
    query.whereBetween('d.date_of_day', [dateRange.from, dateRange.to])
  }
  const rows = (await query) as Array<{ name: string }>
  return rows.map((row) => String(row.name))
}

const loadClubPeriodMetrics = async (
  clubId: string,
  dateRange?: ReportDateRange,
  useImputedMetrics = false
): Promise<ReportVariableDefinition[]> => {
  const names = await distinctClubMetricNames(
    db
      .from('period_metrics as pm')
      .join(periodMetricValuesTable(useImputedMetrics), 'pmv.metric_id', 'pm.id')
      .join('periods as p', 'p.id', 'pmv.period_id')
      .join('sport_activities as sa', 'sa.id', 'p.sport_activity_id')
      .join('days as d', 'd.id', 'sa.day_id')
      .join('athletes as a', 'a.id', 'd.athlete_id')
      .where('a.club_id', clubId)
      .whereIn('pm.data_type', NUMERIC_DATA_TYPES)
      .whereNotNull('pmv.value')
      .whereNot('pmv.value', '')
      .distinct('pm.name')
      .orderBy('pm.name')
      .select('pm.name'),
    dateRange
  )

  if (names.length === 0) return []

  const allowedNames = filterChatbotPeriodMetricNames(clubId, names)
  if (allowedNames.length === 0) return []

  const metrics = await PeriodMetric.query()
    .whereIn('name', allowedNames)
    .whereIn('dataType', NUMERIC_DATA_TYPES)

  return metrics.map((metric) =>
    toEavDefinition(
      REPORT_VARIABLE_PREFIX.PERIOD_METRIC,
      REPORT_CATALOG_GROUP.PERIOD_METRIC,
      {
        name: metric.name,
        displayName: metric.displayName,
        description: metric.description,
        unit: metric.unit,
        aggregationMethod: metric.aggregationMethod,
      },
      METRIC_AGGREGATION_METHOD.SUM
    )
  )
}

const loadClubHealthMetrics = async (
  clubId: string,
  dateRange?: ReportDateRange
): Promise<ReportVariableDefinition[]> => {
  const names = await distinctClubMetricNames(
    db
      .from('health_metrics as hm')
      .join('health_metric_values as hmv', 'hmv.metric_id', 'hm.id')
      .join('health_ratings as hr', 'hr.id', 'hmv.health_id')
      .join('days as d', 'd.id', 'hr.day_id')
      .join('athletes as a', 'a.id', 'd.athlete_id')
      .where('a.club_id', clubId)
      .whereIn('hm.data_type', NUMERIC_DATA_TYPES)
      .whereNotNull('hmv.value')
      .whereNot('hmv.value', '')
      .distinct('hm.name')
      .orderBy('hm.name')
      .select('hm.name'),
    dateRange
  )

  if (names.length === 0) return []

  const metrics = await HealthMetric.query()
    .whereIn('name', names)
    .whereIn('dataType', NUMERIC_DATA_TYPES)

  return metrics.map((metric) =>
    toEavDefinition(
      REPORT_VARIABLE_PREFIX.HEALTH_METRIC,
      REPORT_CATALOG_GROUP.HEALTH,
      {
        name: metric.name,
        displayName: metric.displayName,
        description: metric.description,
        unit: metric.unit,
      },
      METRIC_AGGREGATION_METHOD.AVERAGE
    )
  )
}

const loadClubSleepMetrics = async (
  clubId: string,
  dateRange?: ReportDateRange
): Promise<ReportVariableDefinition[]> => {
  const names = await distinctClubMetricNames(
    db
      .from('sleep_metrics as sm')
      .join('sleep_metric_values as smv', 'smv.metric_id', 'sm.id')
      .join('sleeps as s', 's.id', 'smv.sleep_id')
      .join('days as d', 'd.id', 's.day_id')
      .join('athletes as a', 'a.id', 'd.athlete_id')
      .where('a.club_id', clubId)
      .whereIn('sm.data_type', NUMERIC_DATA_TYPES)
      .whereNotNull('smv.value')
      .whereNot('smv.value', '')
      .distinct('sm.name')
      .orderBy('sm.name')
      .select('sm.name'),
    dateRange
  )

  if (names.length === 0) return []

  const metrics = await SleepMetric.query()
    .whereIn('name', names)
    .whereIn('dataType', NUMERIC_DATA_TYPES)

  return metrics.map((metric) =>
    toEavDefinition(
      REPORT_VARIABLE_PREFIX.SLEEP_METRIC,
      REPORT_CATALOG_GROUP.SLEEP,
      {
        name: metric.name,
        description: metric.description,
        unit: metric.unit,
      },
      METRIC_AGGREGATION_METHOD.AVERAGE
    )
  )
}

const loadClubDayMetrics = async (
  clubId: string,
  dateRange?: ReportDateRange
): Promise<ReportVariableDefinition[]> => {
  const names = await distinctClubMetricNames(
    db
      .from('day_metrics as dm')
      .join('day_metric_values as dmv', 'dmv.metric_id', 'dm.id')
      .join('days as d', 'd.id', 'dmv.day_id')
      .join('athletes as a', 'a.id', 'd.athlete_id')
      .where('a.club_id', clubId)
      .whereIn('dm.data_type', NUMERIC_DATA_TYPES)
      .whereNotNull('dmv.value')
      .whereNot('dmv.value', '')
      .distinct('dm.name')
      .orderBy('dm.name')
      .select('dm.name'),
    dateRange
  )

  if (names.length === 0) return []

  const metrics = await DayMetric.query()
    .whereIn('name', names)
    .whereIn('dataType', NUMERIC_DATA_TYPES)

  return metrics.map((metric) =>
    toEavDefinition(
      REPORT_VARIABLE_PREFIX.DAY_METRIC,
      REPORT_CATALOG_GROUP.DAY_METRIC,
      {
        name: metric.name,
        displayName: dayMetricLabel(metric),
        description: metric.description,
        unit: metric.unit,
      },
      METRIC_AGGREGATION_METHOD.AVERAGE
    )
  )
}

const loadClubBiomarkers = async (
  clubId: string,
  dateRange?: ReportDateRange
): Promise<ReportVariableDefinition[]> => {
  const query = db
    .from('biomarkers as b')
    .join('athletes as a', 'a.id', 'b.athlete_id')
    .join('biomarker_types as bt', 'bt.id', 'b.biomarker_type_id')
    .where('a.club_id', clubId)
    .where((builder) => {
      builder
        .whereNotExists((sub) => {
          sub.from('biomarker_type_clubs as scoped').whereRaw('scoped.biomarker_type_id = bt.id')
        })
        .orWhereExists((sub) => {
          sub
            .from('biomarker_type_clubs as scoped')
            .whereRaw('scoped.biomarker_type_id = bt.id')
            .andWhere('scoped.club_id', clubId)
        })
    })
    .whereNotNull('b.value')
    .whereNot('b.value', '')
    .distinct('bt.name')
    .orderBy('bt.name')
    .select('bt.name')

  if (dateRange) {
    query.whereRaw('b.measured_at::date between ? and ?', [dateRange.from, dateRange.to])
  }

  const rows = (await query) as Array<{ name: string }>
  const names = rows.map((row) => String(row.name))
  if (names.length === 0) return []

  const types = await BiomarkerType.query().whereIn('name', names).orderBy('name', 'asc')

  return types.map((type) => {
    const displayName = type.displayName?.trim() || type.name
    return toEavDefinition(
      REPORT_VARIABLE_PREFIX.BIOMARKER,
      REPORT_CATALOG_GROUP.BIOMARKER,
      {
        name: type.name,
        displayName,
        description: displayName,
        unit: type.unit,
      },
      METRIC_AGGREGATION_METHOD.AVERAGE
    )
  })
}

const toValdDefinition = (
  testType: string,
  metricKey: ValdTrialMetricKey
): ReportVariableDefinition => {
  const field = buildValdVariableField(testType, metricKey)
  return {
    key: buildVariableKey(REPORT_VARIABLE_PREFIX.VALD, field),
    prefix: REPORT_VARIABLE_PREFIX.VALD,
    field,
    group: REPORT_CATALOG_GROUP.VALD,
    name: field,
    description: field,
    unit: valdMetricUnit(metricKey),
    aggregation: METRIC_AGGREGATION_METHOD.MAX,
  }
}

const loadClubVald = async (
  clubId: string,
  dateRange?: ReportDateRange
): Promise<ReportVariableDefinition[]> => {
  const populatedSelects = VALD_TRIAL_METRIC_KEYS.map((key) =>
    db.raw(`BOOL_OR(vt.${key} IS NOT NULL) as ${key}`)
  )

  const query = db
    .from('vald_tests as t')
    .join('days as d', 'd.id', 't.day_id')
    .join('athletes as a', 'a.id', 'd.athlete_id')
    .join('vald_trials as vt', 'vt.vald_test_id', 't.id')
    .where('a.club_id', clubId)
    .groupBy('t.test_type')
    .orderBy('t.test_type', 'asc')
    .select('t.test_type', ...populatedSelects)

  if (dateRange) {
    query.whereBetween('d.date_of_day', [dateRange.from, dateRange.to])
  }

  const rows = (await query) as Array<Record<string, unknown>>
  const definitions: ReportVariableDefinition[] = []

  for (const row of rows) {
    const testType = String(row.test_type ?? '')
    if (!testType) continue

    for (const metricKey of orderedValdMetricsForTestType(testType)) {
      if (!row[metricKey]) continue
      definitions.push(toValdDefinition(testType, metricKey))
    }
  }

  return definitions
}

const loadSubjectiveDefinitions = async (
  clubId: string,
  language: AppLanguage
): Promise<ReportVariableDefinition[]> => {
  const fields = await new SubjectiveScaleService().getClubCatalogue(clubId, language)

  return fields.map((field) => {
    const prefix = SUBJECTIVE_DOMAIN_TO_PREFIX[field.domain]
    const key = buildVariableKey(prefix, field.fieldName)
    const column = columnDefinitionByKey.get(key)
    return {
      key,
      prefix,
      field: field.fieldName,
      group: REPORT_CATALOG_GROUP.SUBJECTIVE,
      name: field.label || column?.name || field.fieldName,
      description: field.intro || column?.description || field.fieldName,
      unit: column?.unit ?? null,
      aggregation: column?.aggregation ?? METRIC_AGGREGATION_METHOD.AVERAGE,
    }
  })
}

const loadClubInsights = async (
  clubId: string,
  dateRange?: ReportDateRange
): Promise<ReportVariableDefinition[]> => {
  const linkedInsightIds = (
    (await db.from('club_insights').where('club_id', clubId).select('insight_id')) as Array<{
      insight_id: string
    }>
  ).map((row) => row.insight_id)

  const query = db
    .from('feature_importances as fi')
    .join('insights as i', 'i.id', 'fi.insight_id')
    .join('days as d', 'd.id', 'fi.day_id')
    .join('athletes as a', 'a.id', 'd.athlete_id')
    .where('a.club_id', clubId)
    .whereNotNull('fi.value')
    .groupBy('i.id', 'i.variable_name', 'i.name', 'i.description')
    .orderBy('i.name')
    .select('i.id', 'i.variable_name', 'i.name', 'i.description')

  if (linkedInsightIds.length > 0) {
    query.whereIn('i.id', linkedInsightIds)
  }

  if (dateRange) {
    query.whereBetween('d.date_of_day', [dateRange.from, dateRange.to])
  }

  const rows = (await query) as Array<{
    id: string
    variable_name: string
    name: string
    description: string | null
  }>

  return rows.map((row) => {
    const field = String(row.variable_name)
    const label = row.name?.trim() || field
    return {
      key: buildVariableKey(REPORT_VARIABLE_PREFIX.INSIGHT, field),
      prefix: REPORT_VARIABLE_PREFIX.INSIGHT,
      field,
      group: REPORT_CATALOG_GROUP.INSIGHT,
      name: label,
      description: row.description?.trim() || label,
      unit: null,
      aggregation: METRIC_AGGREGATION_METHOD.AVERAGE,
    }
  })
}

export const buildVariableCatalog = async (
  clubId: string,
  language: AppLanguage,
  dateRange?: ReportDateRange,
  useImputedMetrics = false
): Promise<ReportCatalog> => {
  const subjective = await loadSubjectiveDefinitions(clubId, language)
  const subjectiveFieldsFor = (prefix: ReportVariablePrefix): string[] =>
    subjective.filter((entry) => entry.prefix === prefix).map((entry) => entry.field)
  const uniqueFields = (fields: string[]): string[] => [...new Set(fields)]

  const [
    periodMetrics,
    healthMetrics,
    sleepMetrics,
    dayMetrics,
    biomarkers,
    vald,
    insights,
    timeSeries,
    derived,
    sportActivityFields,
    healthFields,
    sleepFields,
  ] = await Promise.all([
    loadClubPeriodMetrics(clubId, dateRange, useImputedMetrics),
    loadClubHealthMetrics(clubId, dateRange),
    loadClubSleepMetrics(clubId, dateRange),
    loadClubDayMetrics(clubId, dateRange),
    loadClubBiomarkers(clubId, dateRange),
    loadClubVald(clubId, dateRange),
    loadClubInsights(clubId, dateRange),
    loadClubTimeSeries(clubId, dateRange),
    loadClubDerived(clubId, dateRange),
    loadPopulatedColumnFields({
      table: 'sport_activities',
      alias: 'sa',
      dayForeignKey: 'sa.day_id',
      fields: uniqueFields([
        ...SPORT_ACTIVITY_REPORT_COLUMNS.map((column) => column.field),
        ...subjectiveFieldsFor(REPORT_VARIABLE_PREFIX.SPORT_ACTIVITY),
      ]),
      clubId,
      dateRange,
    }),
    loadPopulatedColumnFields({
      table: 'health_ratings',
      alias: 'hr',
      dayForeignKey: 'hr.day_id',
      fields: uniqueFields([
        ...HEALTH_REPORT_COLUMNS.map((column) => column.field),
        ...subjectiveFieldsFor(REPORT_VARIABLE_PREFIX.HEALTH),
      ]),
      clubId,
      dateRange,
    }),
    loadPopulatedColumnFields({
      table: 'sleeps',
      alias: 's',
      dayForeignKey: 's.day_id',
      fields: uniqueFields([
        ...SLEEP_REPORT_COLUMNS.map((column) => column.field),
        ...subjectiveFieldsFor(REPORT_VARIABLE_PREFIX.SLEEP),
      ]),
      clubId,
      dateRange,
    }),
  ])

  if (sleepFields.has('durationHours') && sleepFields.has('totalInBedTimeMilli')) {
    sleepFields.delete('totalInBedTimeMilli')
  }

  const populatedKeys = new Set<string>([
    ...[...sportActivityFields].map((field) =>
      buildVariableKey(REPORT_VARIABLE_PREFIX.SPORT_ACTIVITY, field)
    ),
    ...[...healthFields].map((field) => buildVariableKey(REPORT_VARIABLE_PREFIX.HEALTH, field)),
    ...[...sleepFields].map((field) => buildVariableKey(REPORT_VARIABLE_PREFIX.SLEEP, field)),
    ...periodMetrics.map((entry) => entry.key),
    ...healthMetrics.map((entry) => entry.key),
    ...sleepMetrics.map((entry) => entry.key),
    ...dayMetrics.map((entry) => entry.key),
    ...biomarkers.map((entry) => entry.key),
    ...vald.map((entry) => entry.key),
  ])

  const eavByLowerName = new Map<string, ReportVariableDefinition>([
    ...healthMetrics.map(
      (entry) => [`${entry.prefix}:${entry.field.toLowerCase()}`, entry] as const
    ),
    ...sleepMetrics.map(
      (entry) => [`${entry.prefix}:${entry.field.toLowerCase()}`, entry] as const
    ),
  ])

  const subjectiveWithData = subjective.flatMap((entry) => {
    if (populatedKeys.has(entry.key)) return [entry]
    if (
      entry.prefix !== REPORT_VARIABLE_PREFIX.HEALTH_METRIC &&
      entry.prefix !== REPORT_VARIABLE_PREFIX.SLEEP_METRIC
    ) {
      return []
    }
    const canonical = eavByLowerName.get(`${entry.prefix}:${entry.field.toLowerCase()}`)
    if (!canonical) return []
    return [
      {
        ...entry,
        key: canonical.key,
        field: canonical.field,
        unit: entry.unit ?? canonical.unit,
      },
    ]
  })
  const subjectiveKeys = new Set(subjectiveWithData.map((entry) => entry.key))
  const columns = toColumnEntries().filter((entry) => {
    if (subjectiveKeys.has(entry.key)) return false
    if (
      entry.prefix === REPORT_VARIABLE_PREFIX.HEALTH ||
      entry.prefix === REPORT_VARIABLE_PREFIX.SLEEP ||
      entry.prefix === REPORT_VARIABLE_PREFIX.SPORT_ACTIVITY
    ) {
      return populatedKeys.has(entry.key)
    }
    return true
  })

  return {
    variables: [
      ...columns,
      ...periodMetrics,
      ...healthMetrics.filter((entry) => !subjectiveKeys.has(entry.key)),
      ...sleepMetrics.filter((entry) => !subjectiveKeys.has(entry.key)),
      ...dayMetrics,
      ...biomarkers,
      ...vald,
      ...subjectiveWithData,
      ...insights,
      ...timeSeries,
      ...derived,
    ].map((definition) => ({
      ...definition,
      unit: displayUnit(definition.field, definition.unit),
    })),
  }
}

export const resolveVariableDefinitions = async (
  keys: string[]
): Promise<Map<string, ReportVariableDefinition>> => {
  const uniqueKeys = [...new Set(keys)]
  const resolved = new Map<string, ReportVariableDefinition>()
  const eavByPrefix: Record<
    | typeof REPORT_VARIABLE_PREFIX.PERIOD_METRIC
    | typeof REPORT_VARIABLE_PREFIX.HEALTH_METRIC
    | typeof REPORT_VARIABLE_PREFIX.SLEEP_METRIC
    | typeof REPORT_VARIABLE_PREFIX.DAY_METRIC
    | typeof REPORT_VARIABLE_PREFIX.BIOMARKER,
    string[]
  > = {
    [REPORT_VARIABLE_PREFIX.PERIOD_METRIC]: [],
    [REPORT_VARIABLE_PREFIX.HEALTH_METRIC]: [],
    [REPORT_VARIABLE_PREFIX.SLEEP_METRIC]: [],
    [REPORT_VARIABLE_PREFIX.DAY_METRIC]: [],
    [REPORT_VARIABLE_PREFIX.BIOMARKER]: [],
  }
  const insightVariableNames: string[] = []

  for (const key of uniqueKeys) {
    const parsed = parseVariableKey(key)
    if (!parsed) continue

    const column = columnDefinitionByKey.get(key)
    if (column) {
      resolved.set(key, column)
      continue
    }

    const timeSeries =
      timeSeriesDefinitionByKey.get(key) ??
      (parsed.prefix === REPORT_VARIABLE_PREFIX.TIME_SERIES
        ? timeSeriesDefinitionForType(parsed.field)
        : null)
    if (timeSeries) {
      resolved.set(key, timeSeries)
      continue
    }

    const derived = derivedDefinitionByKey.get(key)
    if (derived) {
      resolved.set(key, derived)
      continue
    }

    if (parsed.prefix === REPORT_VARIABLE_PREFIX.VALD) {
      const vald = parseValdVariableField(parsed.field)
      if (vald) {
        resolved.set(key, toValdDefinition(vald.testType, vald.metricKey))
      }
      continue
    }
    if (parsed.prefix === REPORT_VARIABLE_PREFIX.PERIOD_METRIC) {
      eavByPrefix[REPORT_VARIABLE_PREFIX.PERIOD_METRIC].push(parsed.field)
    } else if (parsed.prefix === REPORT_VARIABLE_PREFIX.HEALTH_METRIC) {
      eavByPrefix[REPORT_VARIABLE_PREFIX.HEALTH_METRIC].push(parsed.field)
    } else if (parsed.prefix === REPORT_VARIABLE_PREFIX.SLEEP_METRIC) {
      eavByPrefix[REPORT_VARIABLE_PREFIX.SLEEP_METRIC].push(parsed.field)
    } else if (parsed.prefix === REPORT_VARIABLE_PREFIX.DAY_METRIC) {
      eavByPrefix[REPORT_VARIABLE_PREFIX.DAY_METRIC].push(parsed.field)
    } else if (parsed.prefix === REPORT_VARIABLE_PREFIX.BIOMARKER) {
      eavByPrefix[REPORT_VARIABLE_PREFIX.BIOMARKER].push(parsed.field)
    } else if (parsed.prefix === REPORT_VARIABLE_PREFIX.INSIGHT) {
      insightVariableNames.push(parsed.field)
    }
  }

  const [periodMetrics, healthMetrics, sleepMetrics, dayMetrics, biomarkers, insights] =
    await Promise.all([
      eavByPrefix.periodMetric.length
        ? PeriodMetric.query()
            .whereIn('dataType', NUMERIC_DATA_TYPES)
            .where((query) => {
              query.whereIn('name', eavByPrefix.periodMetric)
              for (const field of eavByPrefix.periodMetric) {
                query.orWhereILike('display_name', field)
                query.orWhereRaw("replace(lower(name), '_', ' ') = ?", [field.toLowerCase()])
              }
            })
        : Promise.resolve([]),
      eavByPrefix.healthMetric.length
        ? HealthMetric.query()
            .whereIn('dataType', NUMERIC_DATA_TYPES)
            .where((query) => {
              query.whereIn('name', eavByPrefix.healthMetric)
              for (const field of eavByPrefix.healthMetric) {
                query.orWhereILike('display_name', field)
                query.orWhereRaw("replace(lower(name), '_', ' ') = ?", [field.toLowerCase()])
              }
            })
        : Promise.resolve([]),
      eavByPrefix.sleepMetric.length
        ? SleepMetric.query()
            .whereIn('dataType', NUMERIC_DATA_TYPES)
            .where((query) => {
              query.whereIn('name', eavByPrefix.sleepMetric)
              for (const field of eavByPrefix.sleepMetric) {
                query.orWhereRaw("replace(lower(name), '_', ' ') = ?", [field.toLowerCase()])
              }
            })
        : Promise.resolve([]),
      eavByPrefix.dayMetric.length
        ? DayMetric.query()
            .whereIn('name', eavByPrefix.dayMetric)
            .whereIn('dataType', NUMERIC_DATA_TYPES)
        : Promise.resolve([]),
      eavByPrefix.biomarker.length
        ? BiomarkerType.query().whereIn('name', eavByPrefix.biomarker)
        : Promise.resolve([]),
      insightVariableNames.length
        ? Insight.query().whereIn('variableName', insightVariableNames)
        : Promise.resolve([]),
    ])

  registerEavDefinitions(
    resolved,
    REPORT_VARIABLE_PREFIX.PERIOD_METRIC,
    REPORT_CATALOG_GROUP.PERIOD_METRIC,
    eavByPrefix.periodMetric,
    periodMetrics,
    METRIC_AGGREGATION_METHOD.SUM
  )
  registerEavDefinitions(
    resolved,
    REPORT_VARIABLE_PREFIX.HEALTH_METRIC,
    REPORT_CATALOG_GROUP.HEALTH,
    eavByPrefix.healthMetric,
    healthMetrics,
    METRIC_AGGREGATION_METHOD.AVERAGE
  )
  registerEavDefinitions(
    resolved,
    REPORT_VARIABLE_PREFIX.SLEEP_METRIC,
    REPORT_CATALOG_GROUP.SLEEP,
    eavByPrefix.sleepMetric,
    sleepMetrics,
    METRIC_AGGREGATION_METHOD.AVERAGE
  )

  for (const metric of dayMetrics) {
    const definition = toEavDefinition(
      REPORT_VARIABLE_PREFIX.DAY_METRIC,
      REPORT_CATALOG_GROUP.DAY_METRIC,
      {
        name: metric.name,
        displayName: dayMetricLabel(metric),
        description: metric.description,
        unit: metric.unit,
      },
      METRIC_AGGREGATION_METHOD.AVERAGE
    )
    resolved.set(definition.key, definition)
  }

  for (const type of biomarkers) {
    const definition = toEavDefinition(
      REPORT_VARIABLE_PREFIX.BIOMARKER,
      REPORT_CATALOG_GROUP.BIOMARKER,
      {
        name: type.name,
        displayName: type.displayName?.trim() || type.name,
        description: type.displayName?.trim() || type.name,
        unit: type.unit,
      },
      METRIC_AGGREGATION_METHOD.AVERAGE
    )
    resolved.set(definition.key, definition)
  }

  for (const insight of insights) {
    const label = insight.name?.trim() || insight.variableName
    const key = buildVariableKey(REPORT_VARIABLE_PREFIX.INSIGHT, insight.variableName)
    resolved.set(key, {
      key,
      prefix: REPORT_VARIABLE_PREFIX.INSIGHT,
      field: insight.variableName,
      group: REPORT_CATALOG_GROUP.INSIGHT,
      name: label,
      description: insight.description?.trim() || label,
      unit: null,
      aggregation: METRIC_AGGREGATION_METHOD.AVERAGE,
    })
  }

  return resolved
}
