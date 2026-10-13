import { DateTime } from 'luxon'
import type { MetricAggregationMethod, MetricDataType } from '#constants/metrics.constants'

export function bilingualName(
  row: Record<string, unknown>,
  enKey = 'name_en',
  frKey = 'name_fr'
): string {
  const en = row[enKey] as string | null | undefined
  const fr = row[frKey] as string | null | undefined
  return en || fr || ''
}

export function mapGender(gender: string | null | undefined): 'male' | 'female' {
  return gender === 'Female' ? 'female' : 'male'
}

function isValidDate(date: Date): boolean {
  return !Number.isNaN(date.getTime())
}

export function toDate(value: unknown): string | null {
  if (value === null || value === undefined) return null

  if (value instanceof Date) {
    return isValidDate(value) ? DateTime.fromJSDate(value).toISODate() : null
  }

  const str = String(value).trim()
  if (!str || str.startsWith('0000-00-00')) return null

  if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
    return str.slice(0, 10)
  }

  const fromIso = DateTime.fromISO(str, { setZone: true })
  if (fromIso.isValid) return fromIso.toISODate()

  const fromSql = DateTime.fromSQL(str)
  if (fromSql.isValid) return fromSql.toISODate()

  const fromJs = DateTime.fromJSDate(new Date(str))
  if (fromJs.isValid) return fromJs.toISODate()

  return null
}

export function toTimestamp(value: unknown): Date | null {
  if (value === null || value === undefined) return null
  if (value instanceof Date) {
    return isValidDate(value) ? value : null
  }

  const str = String(value).trim()
  if (!str || str.startsWith('0000-00-00')) return null

  const fromIso = DateTime.fromISO(str, { setZone: true })
  if (fromIso.isValid) return fromIso.toJSDate()

  const fromSql = DateTime.fromSQL(str)
  if (fromSql.isValid) return fromSql.toJSDate()

  const jsDate = new Date(str)
  if (isValidDate(jsDate) && DateTime.fromJSDate(jsDate).isValid) {
    return jsDate
  }

  return null
}

export function timestamps(
  row: Record<string, unknown>,
  options: { createdKeys?: string[]; updatedKeys?: string[] } = {}
): { created_at: Date; updated_at: Date } {
  const now = new Date()
  const createdKeys = options.createdKeys ?? ['created_at']
  const updatedKeys = options.updatedKeys ?? ['updated_at', ...createdKeys]

  const pick = (keys: string[]) => {
    for (const key of keys) {
      const ts = toTimestamp(row[key])
      if (ts) return ts
    }
    return null
  }

  const created_at = pick(createdKeys) ?? now
  const updated_at = pick(updatedKeys) ?? created_at

  return {
    created_at: isValidDate(created_at) ? created_at : now,
    updated_at: isValidDate(updated_at) ? updated_at : created_at,
  }
}

export function durationMicrosToSeconds(duration: number | null | undefined): number | null {
  if (duration === null || duration === undefined) return null
  return Math.round(duration / 1_000_000)
}

export function extractTime(value: unknown): string | null {
  if (value === null || value === undefined) return null
  const str = String(value)
  if (/^\d{2}:\d{2}:\d{2}/.test(str)) return str.slice(0, 8)
  const match = str.match(/(\d{2}:\d{2}:\d{2})/)
  return match ? match[1] : null
}

export function toFloat(value: unknown): number | null {
  if (value === null || value === undefined) return null
  const n = Number.parseFloat(String(value))
  return Number.isNaN(n) ? null : n
}

/** Preserve decimal values from MySQL float/decimal columns (no rounding). */
export const toDecimal = toFloat

export function toInt(value: unknown): number | null {
  if (value === null || value === undefined) return null
  const n = Number.parseFloat(String(value))
  if (Number.isNaN(n)) return null
  return Math.round(n)
}

export function minutesToSeconds(value: unknown): number | null {
  const minutes = toInt(value)
  if (minutes === null) return null
  return Math.round(minutes * 60)
}

export function toBool(value: unknown): boolean {
  return value === true || value === 1 || value === '1'
}

export function toJson(value: unknown): unknown {
  if (value === null || value === undefined) return null
  if (typeof value === 'string') {
    try {
      return JSON.parse(value)
    } catch {
      return null
    }
  }
  if (Buffer.isBuffer(value)) {
    try {
      return JSON.parse(value.toString('utf8'))
    } catch {
      return null
    }
  }
  return value
}

function toPgEnum<T extends string>(value: unknown, fallback: T, allowed: readonly T[]): T {
  const normalized = String(value ?? fallback)
    .trim()
    .toLowerCase() as T
  return allowed.includes(normalized) ? normalized : fallback
}

export function toLowerEnum(value: unknown, fallback = ''): string {
  return String(value ?? fallback)
    .trim()
    .toLowerCase()
}

export function timeValueToSeconds(value: unknown): number | null {
  const asInt = toInt(value)
  if (asInt !== null && !String(value).includes(':')) return asInt

  const str = String(value ?? '')
  const match = str.match(/^(\d{1,2}):(\d{2}):(\d{2})/)
  if (!match) return null

  return Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3])
}

export function secondsToTime(value: unknown): string | null {
  const seconds = toInt(value)
  if (seconds === null) return null
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

/** MySQL: FLOAT, INTEGER… → PG: float, integer… */
export function mapMetricDataType(value: unknown): MetricDataType {
  return toPgEnum(value, 'float', ['float', 'integer', 'string', 'boolean'])
}

/** MySQL: SUM, AVERAGE… → PG: sum, average… */
export function mapAggregationMethod(value: unknown): MetricAggregationMethod {
  return toPgEnum(value, 'average', ['sum', 'average', 'max', 'min'])
}

/** MySQL series: UNSIGNED, FLOAT, SIGNED → PG: unsigned, float, signed */
export function mapSerieDataType(value: unknown): 'unsigned' | 'float' | 'signed' {
  return toPgEnum(value, 'unsigned', ['unsigned', 'float', 'signed'])
}
