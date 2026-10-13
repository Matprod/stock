import {
  STATSSPORTS_CONTEXT_FIELDS,
  STATSSPORTS_PERIOD_METRICS,
  type ApiStatssportsRow,
  type StatssportsContextField,
  type StatssportsContextValues,
  type StatssportsPeriodMetric,
  type StatssportsPeriodMetricValues,
} from '#constants/statsports.constants'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { DateTime } from 'luxon'

export type {
  ApiStatssportsRow,
  StatssportsContextField,
  StatssportsContextValues,
  StatssportsPeriodMetric,
  StatssportsPeriodMetricValues,
}

export const FBL_API_MAPPING_FILE = join(process.cwd(), 'hambourg/fbl_api_mapping.csv')

export type FblMappingStatus = 'direct' | 'derived' | 'not_in_api' | 'empty'

export type FblMappingEntry = {
  fblColumn: string
  apiColumn: string
  status: FblMappingStatus
}

export type ExcelStatssportsRow = Record<string, unknown>

function parseMappingLine(line: string): FblMappingEntry {
  const lastComma = line.lastIndexOf(',')
  const status = line.slice(lastComma + 1).trim() as FblMappingStatus
  const rest = line.slice(0, lastComma)
  const firstComma = rest.indexOf(',')
  return {
    fblColumn: rest.slice(0, firstComma).trim(),
    apiColumn: rest.slice(firstComma + 1).trim(),
    status,
  }
}

export function loadFblApiMapping(): FblMappingEntry[] {
  const content = readFileSync(FBL_API_MAPPING_FILE, 'utf-8').replace(/^\uFEFF/, '')
  return content.trim().split(/\r?\n/).slice(1).map(parseMappingLine)
}

export function getDirectFblMapping(mapping = loadFblApiMapping()): FblMappingEntry[] {
  return mapping.filter(
    (entry) =>
      entry.status === 'direct' &&
      !entry.apiColumn.startsWith('NOT_IN_API') &&
      entry.apiColumn !== 'EMPTY'
  )
}

function createEmptyApiRow(): ApiStatssportsRow {
  const row = {} as ApiStatssportsRow

  for (const key of STATSSPORTS_CONTEXT_FIELDS) {
    row[key] = null
  }
  for (const key of STATSSPORTS_PERIOD_METRICS) {
    row[key] = null
  }

  return row
}

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

function excelSerialToDateTime(serial: number): DateTime {
  return DateTime.fromObject({ year: 1899, month: 12, day: 30 }, { zone: 'utc' }).plus({
    days: serial,
  })
}

function parseExcelDate(value: unknown): string | null {
  if (value instanceof Date) return DateTime.fromJSDate(value).toISODate()
  if (typeof value === 'string' && value.trim()) {
    const parsed = DateTime.fromISO(value)
    return parsed.isValid ? parsed.toISODate() : null
  }
  const serial = toNumber(value)
  if (serial === null) return null
  return excelSerialToDateTime(serial).toISODate()
}

function parseExcelTime(value: unknown): string | null {
  const serial = toNumber(value)
  if (serial === null) return null
  if (serial >= 0 && serial < 1) {
    const totalSeconds = Math.round(serial * 86400)
    const hours = Math.floor(totalSeconds / 3600)
    const minutes = Math.floor((totalSeconds % 3600) / 60)
    const seconds = totalSeconds % 60
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
  }
  return String(value)
}

function parseExcelDuration(value: unknown): number | null {
  if (typeof value === 'string') {
    const trimmed = value.trim()
    const match = trimmed.match(/^(\d+):(\d{1,2})(?::(\d{1,2}(?:\.\d+)?))?$/)
    if (match) {
      const hours = Number(match[1])
      const minutes = Number(match[2])
      const seconds = match[3] !== undefined ? Number(match[3]) : 0
      if (![hours, minutes, seconds].every(Number.isFinite)) return null
      return Math.round(hours * 3600 + minutes * 60 + seconds)
    }
  }

  const serial = toNumber(value)
  if (serial === null) return null
  if (serial >= 0 && serial < 1) return Math.round(serial * 86400)
  return serial
}

const TIME_OF_DAY_API_COLUMNS = new Set<StatssportsContextField>([
  'session_start_time',
  'session_end_time',
  'drill_start_time',
  'drill_end_time',
])

/** Excel duration columns (day-fraction or HH:MM:SS) → seconds. Not percentages. */
const DURATION_SECONDS_API_COLUMNS = new Set<StatssportsPeriodMetric>([
  'kpi_totalTime',
  'kpi_timeHeartRateZ1Rel',
  'kpi_timeHeartRateZ2Rel',
  'kpi_timeHeartRateZ3Rel',
  'kpi_timeHeartRateZ4Rel',
  'kpi_timeHeartRateZ5Rel',
  'kpi_timeHeartRateZ6Rel',
  'kpi_timeHeartRateZ2Z6Rel',
  'kpi_timeHeartRateZ3Z6Rel',
  'kpi_timeHeartRateZ4Z6Rel',
  'kpi_timeInRedZoneRel',
  'kpi_accelerationTimeZ1Rel',
  'kpi_accelerationTimeZ2Rel',
  'kpi_accelerationTimeZ3Rel',
  'kpi_accelerationTimeZ4Rel',
  'kpi_accelerationTimeZ5Rel',
  'kpi_accelerationTimeZ6Rel',
  'kpi_decelerationTimeZ1Rel',
  'kpi_decelerationTimeZ2Rel',
  'kpi_decelerationTimeZ3Rel',
  'kpi_decelerationTimeZ4Rel',
  'kpi_decelerationTimeZ5Rel',
  'kpi_decelerationTimeZ6Rel',
  'kpi_dslZ1Time',
  'kpi_dslZ2Time',
  'kpi_dslZ3Time',
  'kpi_dslZ4Time',
  'kpi_dslZ5Time',
  'kpi_dslZ6Time',
  'kpi_metabolicTimeAbs',
  'kpi_metabolicTimeZ1Abs',
  'kpi_metabolicTimeZ2Abs',
  'kpi_metabolicTimeZ3Abs',
  'kpi_metabolicTimeZ4Abs',
  'kpi_metabolicTimeZ5Abs',
  'kpi_metabolicTimeZ6Abs',
  'kpi_hibsDuration',
  'kpi_hmlTime',
  'kpi_averageTimeSinceLastAccel',
  'kpi_averageTimeSinceLastDecel',
  'kpi_averageTimeSinceLastDive',
  'kpi_averageTimeSinceHib',
  'kpi_averageTimeSinceLastHmlEffort',
  'kpi_averageTimeSinceSprint',
  'kpi_timeZ1Abs',
  'kpi_timeZ2Abs',
  'kpi_timeZ3Abs',
  'kpi_timeZ4Abs',
  'kpi_timeZ5Abs',
  'kpi_timeZ6Abs',
  'kpi_timeZ1Rel',
  'kpi_timeZ2Rel',
  'kpi_timeZ3Rel',
  'kpi_timeZ4Rel',
  'kpi_timeZ5Rel',
  'kpi_timeZ6Rel',
])

function parseDirectValue(
  apiColumn: StatssportsContextField | StatssportsPeriodMetric,
  value: unknown
): string | number | null {
  if (value === null || value === undefined || value === '') return null

  if (apiColumn === 'session_date' || apiColumn === 'player_dateOfBirth') {
    return parseExcelDate(value)
  }

  if (TIME_OF_DAY_API_COLUMNS.has(apiColumn as StatssportsContextField)) {
    return parseExcelTime(value)
  }

  if (DURATION_SECONDS_API_COLUMNS.has(apiColumn as StatssportsPeriodMetric)) {
    return parseExcelDuration(value)
  }

  const numeric = toNumber(value)
  if (numeric !== null && apiColumn.startsWith('kpi_')) return numeric

  if (typeof value === 'string') return value.trim()

  if (typeof value === 'number') return value

  return String(value)
}

export function transformExcelRowToApiRow(
  excelRow: ExcelStatssportsRow,
  mapping = getDirectFblMapping()
): ApiStatssportsRow {
  const apiRow = createEmptyApiRow()

  for (const entry of mapping) {
    const apiColumn = entry.apiColumn as StatssportsContextField | StatssportsPeriodMetric
    const value = parseDirectValue(apiColumn, excelRow[entry.fblColumn])

    if (apiColumn.startsWith('kpi_')) {
      apiRow[apiColumn as StatssportsPeriodMetric] =
        typeof value === 'number' ? value : toNumber(value)
      continue
    }

    apiRow[apiColumn as StatssportsContextField] = value
  }

  return apiRow
}

export function splitApiRow(apiRow: ApiStatssportsRow): {
  periodMetrics: StatssportsPeriodMetricValues
  context: StatssportsContextValues
} {
  const periodMetrics = {} as StatssportsPeriodMetricValues
  const context = {} as StatssportsContextValues

  for (const key of STATSSPORTS_PERIOD_METRICS) {
    periodMetrics[key] = typeof apiRow[key] === 'number' ? apiRow[key] : toNumber(apiRow[key])
  }

  for (const key of STATSSPORTS_CONTEXT_FIELDS) {
    context[key] = apiRow[key]
  }

  return { periodMetrics, context }
}
