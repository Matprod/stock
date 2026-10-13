import type { TeamPartitionState } from '#contracts/agent'
import {
  SQL_PARTITION_TARGET_CHARS,
  SQL_PARTITION_TARGET_ROWS,
  SQL_RESULT_DECIMAL_PLACES,
} from '#constants/agent.constants'

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const DECIMAL_FACTOR = 10 ** SQL_RESULT_DECIMAL_PLACES

const roundNumericValue = (value: unknown): unknown => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    if (Number.isInteger(value)) return value
    return Math.round(value * DECIMAL_FACTOR) / DECIMAL_FACTOR
  }
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!/^-?\d+\.\d{2,}$/.test(trimmed)) return value
    const parsed = Number(trimmed)
    if (!Number.isFinite(parsed)) return value
    return String(Math.round(parsed * DECIMAL_FACTOR) / DECIMAL_FACTOR)
  }
  return value
}

export const roundSqlRowValues = (
  rows: Record<string, unknown>[]
): Record<string, unknown>[] =>
  rows.map((row) => {
    const out: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(row)) {
      out[key] = roundNumericValue(value)
    }
    return out
  })

export const createTeamPartitionState = (): TeamPartitionState => ({
  datesQueried: new Set(),
  slices: [],
})

export const extractIsoDatesFromSql = (sql: string): string[] => {
  const dates = new Set<string>()
  const re = /'(\d{4}-\d{2}-\d{2})'/g
  let m: RegExpExecArray | null
  while ((m = re.exec(sql)) !== null) dates.add(m[1])
  return [...dates].sort()
}

export const isAggregatedSql = (sql: string): boolean =>
  /\bGROUP\s+BY\b/i.test(sql) || /\bCOUNT\s*\(\s*(?:\*|DISTINCT)/i.test(sql)

export const compactTeamRows = (rows: unknown[]): Record<string, unknown>[] =>
  rows.map((row) => {
    if (!row || typeof row !== 'object' || Array.isArray(row)) return {}
    const out: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(row as Record<string, unknown>)) {
      if (typeof value === 'string' && UUID_RE.test(value)) continue
      if (typeof value === 'string' && value.length > 80) {
        out[key] = `${value.slice(0, 80)}…`
        continue
      }
      out[key] = value
    }
    return out
  })

export const buildTeamPartitionHint = (args: {
  reason: 'REDUCE_SCOPE' | 'REDUCE_PAYLOAD'
  hint: string
  state?: TeamPartitionState
  rowCount?: number
  resultChars?: number
}): string => {
  const datesCovered = args.state ? [...args.state.datesQueried].sort() : []
  return JSON.stringify({
    partition_hint: args.reason,
    row_count: args.rowCount,
    target_rows: SQL_PARTITION_TARGET_ROWS,
    target_chars: SQL_PARTITION_TARGET_CHARS,
    result_chars: args.resultChars,
    hint: args.hint,
    dates_covered_so_far: datesCovered,
  })
}

export const buildTeamPartitionMeta = (
  state: TeamPartitionState,
  sliceDates: string[],
  rowCount: number,
  resultChars: number
) => {
  const avgChars =
    state.slices.length > 0
      ? Math.round(state.slices.reduce((s, x) => x.resultChars + s, 0) / state.slices.length)
      : resultChars
  return {
    dates_this_slice: sliceDates,
    dates_covered_so_far: [...state.datesQueried].sort(),
    slice_rows: rowCount,
    slice_chars: resultChars,
    target_rows: SQL_PARTITION_TARGET_ROWS,
    target_chars: SQL_PARTITION_TARGET_CHARS,
    avg_slice_chars: avgChars,
  }
}
