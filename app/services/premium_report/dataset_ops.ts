import { pickAthleteColumn } from '#constants/premium_report_metrics'
import {
  PREMIUM_REPORT_MAX_DATASET_ROWS,
  PREMIUM_REPORT_SAMPLE_ROWS,
} from '#constants/premium_report.constants'
import type { PremiumDataset } from '#contracts/premium_report'
import type { PremiumDomain } from '#constants/premium_report_domains'
import type { PremiumReportState } from '#services/premium_report/premium_report_tools'

type DatasetToolResultOptions = {
  sampleRows?: number
}

const IDENTITY_COLUMNS = new Set([
  'id',
  'athlete_id',
  'unit',
  'joueur',
  'player',
  'position',
  'name',
  'date',
  'date_of_day',
  'activity',
  'activity_type',
  'metric_name',
  'method',
  'x_column',
  'y_column',
  'n',
])

const copyMeta = (
  dataset: PremiumDataset,
  columns?: string[]
): Pick<PremiumDataset, 'units' | 'labels' | 'domain'> => {
  const filterMap = (map?: Record<string, string>) => {
    if (!map || Object.keys(map).length === 0) return undefined
    if (!columns) return { ...map }
    const next = Object.fromEntries(
      Object.entries(map).filter(([column]) => columns.includes(column))
    )
    return Object.keys(next).length ? next : undefined
  }
  const units = filterMap(dataset.units)
  const labels = filterMap(dataset.labels)
  return {
    ...(units ? { units } : {}),
    ...(labels ? { labels } : {}),
    ...(dataset.domain ? { domain: dataset.domain } : {}),
  }
}

const nextAutoDatasetId = (state: PremiumReportState): string => {
  let n = 1
  while (state.datasets.has(`ds_${n}`)) n += 1
  return `ds_${n}`
}

export const storeDataset = (
  state: PremiumReportState,
  dataset: PremiumDataset
): PremiumDataset => {
  const id =
    dataset.id === 'roster' && !state.datasets.has('roster')
      ? 'roster'
      : nextAutoDatasetId(state)
  const stored = {
    ...dataset,
    id,
    ...copyMeta(dataset),
  }
  state.datasets.set(id, stored)
  return stored
}

export const datasetToolResult = (
  dataset: PremiumDataset,
  extra?: Record<string, unknown>,
  options?: DatasetToolResultOptions
) => {
  const sampleRows = options?.sampleRows ?? PREMIUM_REPORT_SAMPLE_ROWS
  return JSON.stringify({
    ok: true,
    datasetId: dataset.id,
    columns: dataset.columns,
    rowCount: dataset.rows.length,
    ...(sampleRows > 0 ? { sample: dataset.rows.slice(0, sampleRows) } : {}),
    ...(dataset.dateRange ? { dateRange: dataset.dateRange } : {}),
    ...copyMeta(dataset),
    ...extra,
  })
}

export const commitDataset = (
  state: PremiumReportState,
  dataset: PremiumDataset,
  extra?: Record<string, unknown>,
  options?: DatasetToolResultOptions
): string => datasetToolResult(storeDataset(state, dataset), extra, options)

export const requireDataset = (
  state: PremiumReportState,
  input: Record<string, unknown>
): PremiumDataset | string => {
  const datasetId = readString(input.datasetId)
  if (!datasetId) return JSON.stringify({ error: 'datasetId required' })
  const dataset = state.datasets.get(datasetId)
  if (!dataset) {
    return JSON.stringify({
      error: `Unknown datasetId '${datasetId}'`,
      available_ids: [...state.datasets.keys()],
    })
  }
  return dataset
}

const columnMissingError = (column: string, available: string[]): string =>
  JSON.stringify({
    error: `Column '${column}' not found in dataset.`,
    available_columns: available,
  })

export const resolveDatasetColumn = (
  dataset: PremiumDataset,
  wanted: string
): string | undefined => {
  const needle = wanted.trim()
  if (!needle) return undefined
  return (
    dataset.columns.find((col) => col === needle) ??
    dataset.columns.find((col) => col.toLowerCase() === needle.toLowerCase())
  )
}

/** Fail-fast: every requested name must exist (case-insensitive). Returns error JSON or null. */
export const requireDatasetColumns = (
  dataset: PremiumDataset,
  columns: Array<string | undefined | null>
): string | null => {
  for (const raw of columns) {
    if (raw == null || !String(raw).trim()) continue
    const wanted = String(raw).trim()
    if (!resolveDatasetColumn(dataset, wanted)) {
      return columnMissingError(wanted, dataset.columns)
    }
  }
  return null
}

export const defaultGroupBy = (dataset: PremiumDataset, preferred?: string): string | undefined =>
  preferred ?? pickAthleteColumn(dataset.columns)

export const readDateRange = (
  input: Record<string, unknown>,
  fallback: { from: string; to: string }
): { from: string; to: string } => {
  const requested = {
    from: readString(input.from) ?? fallback.from,
    to: readString(input.to) ?? fallback.to,
  }
  return clampDateRange(requested, fallback)
}

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/

const isIsoDate = (value: string | undefined): value is string =>
  Boolean(value && ISO_DATE_RE.test(value))

const clampDateRange = (
  requested: { from: string; to: string },
  allowed: { from: string; to: string }
): { from: string; to: string } => {
  if (!isIsoDate(requested.from) || !isIsoDate(requested.to) || requested.from > requested.to) {
    return { from: allowed.from, to: allowed.to }
  }
  const from = requested.from < allowed.from ? allowed.from : requested.from
  const to = requested.to > allowed.to ? allowed.to : requested.to
  // Entirely outside Cover (e.g. December biomarkers when Display is March): keep the
  // explicit ISO window instead of silently swapping to Cover — that caused Sep–Oct fetches
  // when Cover was the lean fallback and the Linker later passed the right month.
  if (from > to) return { from: requested.from, to: requested.to }
  return { from, to }
}

export const resolveMacroDateRange = (
  state: Pick<
    PremiumReportState,
    'dateRange' | 'displayRange' | 'fetchRange' | 'domainRanges' | 'coverRange' | 'fetchWindows'
  >,
  domain: PremiumDomain | undefined,
  input: Record<string, unknown>
): { from: string; to: string } => {
  const fromRaw = readString(input.from)
  const toRaw = readString(input.to)
  const from = isIsoDate(fromRaw) ? fromRaw : undefined
  const to = isIsoDate(toRaw) ? toRaw : undefined
  const display = state.displayRange ?? state.dateRange
  const cover = state.coverRange ?? display
  const domainFetches = domain
    ? (state.fetchWindows ?? []).filter((row) => row.domain === domain)
    : []

  // Multi-window domain (e.g. wellness mood vs stress): honour the exact from/to the linker passed.
  if (domainFetches.length > 1) {
    if (from && to) {
      const exact = domainFetches.find((row) => row.from === from && row.to === to)
      if (exact) return { from: exact.from, to: exact.to }
      const containing = domainFetches.find((row) => from >= row.from && to <= row.to)
      if (containing) return clampDateRange({ from, to }, containing)
      // Allow any window inside Cover (union) — do not collapse to a single domainRange.
      const ceiling = cover ?? display
      return ceiling ? clampDateRange({ from, to }, ceiling) : { from, to }
    }
    // No from/to: cannot pick among several windows — fall through to single-domain fallback.
  }

  const domainRange =
    domainFetches.length === 1
      ? { from: domainFetches[0]!.from, to: domainFetches[0]!.to }
      : domain
        ? state.domainRanges?.[domain]
        : undefined

  if (domainRange) {
    if (!from || !to) return domainRange
    const matchesDisplay = Boolean(display) && from === display.from && to === display.to
    const requestOverlapsDomain = from <= domainRange.to && domainRange.from <= to
    if (!requestOverlapsDomain) {
      if (matchesDisplay) return { from, to }
      if (cover && from >= cover.from && to <= cover.to) return { from, to }
      return domainRange
    }
    const domainDiffers =
      !display || domainRange.from !== display.from || domainRange.to !== display.to
    const domainOverlapsDisplay =
      Boolean(display) && domainRange.from <= display!.to && display!.from <= domainRange.to
    if (matchesDisplay && domainDiffers) {
      return domainOverlapsDisplay ? domainRange : { from, to }
    }
    return clampDateRange({ from, to }, domainRange)
  }

  if (domain === 'load' && state.fetchRange) {
    if (!from || !to) return state.fetchRange
    const matchesDisplay = Boolean(display) && from === display!.from && to === display!.to
    const matchesCover = Boolean(cover) && from === cover!.from && to === cover!.to
    if (matchesDisplay || matchesCover) return state.fetchRange
    return clampDateRange({ from, to }, state.fetchRange)
  }

  if (from && to) {
    const ceiling = cover ?? display
    return ceiling ? clampDateRange({ from, to }, ceiling) : { from, to }
  }

  return display ?? cover ?? state.dateRange
}

export const stampDatasetDateRange = (
  dataset: PremiumDataset,
  range: { from: string; to: string }
): PremiumDataset => {
  dataset.dateRange = { from: range.from, to: range.to }
  return dataset
}

export const stampDatasetDomain = (
  dataset: PremiumDataset,
  domain: PremiumDomain | undefined
): PremiumDataset => {
  if (domain) dataset.domain = domain
  return dataset
}

export const readString = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  return trimmed.length ? trimmed : undefined
}

export const readStringList = (value: unknown): string[] =>
  Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    : []

export const readPositiveInt = (value: unknown, fallback: number): number => {
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(n) && n >= 2 ? Math.floor(n) : fallback
}

export const toNumber = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim() !== '') {
    let compact = value.trim().replace(/[\s\u202f\u00a0]/g, '')
    if (/^-?\d{1,3}(,\d{3})+(\.\d+)?$/.test(compact)) {
      compact = compact.replace(/,/g, '')
    } else if (/^-?\d{1,3}(\.\d{3})+(,\d+)?$/.test(compact)) {
      compact = compact.replace(/\./g, '').replace(',', '.')
    } else {
      compact = compact.replace(',', '.')
    }
    if (!/^-?\d+(\.\d+)?$/.test(compact)) return null
    const n = Number(compact)
    return Number.isFinite(n) ? n : null
  }
  return null
}

const readFilterValue = (
  raw: unknown
): { kind: 'string'; value: string } | { kind: 'number'; value: number } | null => {
  if (typeof raw === 'number' && Number.isFinite(raw)) return { kind: 'number', value: raw }
  if (typeof raw === 'string') {
    const trimmed = raw.trim()
    if (!trimmed) return null
    return { kind: 'string', value: trimmed }
  }
  return null
}

export const parseFilterCompare = (raw: unknown, op: string): number | string | null => {
  const parsed = readFilterValue(raw)
  if (!parsed) return null
  const asText = op === 'contains' || parsed.kind === 'string'
  if (asText) return parsed.kind === 'string' ? parsed.value : String(parsed.value)
  return parsed.value
}

export const round3 = (value: number): number => Math.round(value * 1000) / 1000

const numberFormatters = {
  fr: {
    int: new Intl.NumberFormat('fr'),
    float: new Intl.NumberFormat('fr', { maximumFractionDigits: 2 }),
  },
  en: {
    int: new Intl.NumberFormat('en'),
    float: new Intl.NumberFormat('en', { maximumFractionDigits: 2 }),
  },
} as const

export const formatDisplayNumber = (value: number, language: 'fr' | 'en' = 'fr'): string => {
  if (!Number.isFinite(value)) return ''
  const formatters = numberFormatters[language]
  return Number.isInteger(value) ? formatters.int.format(value) : formatters.float.format(value)
}

export const formatDisplayCell = (
  value: unknown,
  language: 'fr' | 'en' = 'fr'
): string | number | null => {
  if (value === null || value === undefined) return null
  const numeric = toNumber(value)
  if (
    numeric != null &&
    (typeof value === 'number' ||
      (typeof value === 'string' && /^-?[\d\s\u202f\u00a0.,]+$/.test(value.trim())))
  ) {
    return formatDisplayNumber(numeric, language)
  }
  if (typeof value === 'string' || typeof value === 'number') return value
  return String(value)
}

type ColumnStats = {
  mean: number
  median: number
  min: number
  max: number
  n: number
  uniqueCount: number
}

export const columnStats = (
  rows: Array<Record<string, unknown>>,
  column: string
): ColumnStats | null => {
  const values: number[] = []
  const unique = new Set<number>()
  for (const row of rows) {
    const n = toNumber(row[column])
    if (n == null) continue
    values.push(n)
    unique.add(n)
  }
  if (values.length < 2) return null
  const sorted = [...values].sort((a, b) => a - b)
  const sum = values.reduce((acc, v) => acc + v, 0)
  const mid = Math.floor(sorted.length / 2)
  const median = sorted.length % 2 === 1 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2
  return {
    mean: round3(sum / values.length),
    median: round3(median),
    min: sorted[0]!,
    max: sorted[sorted.length - 1]!,
    n: values.length,
    uniqueCount: unique.size,
  }
}

export const isOrdinalScore = (rows: Array<Record<string, unknown>>, column: string): boolean => {
  const stats = columnStats(rows, column)
  if (!stats) return false
  return stats.uniqueCount <= 6 && stats.n >= stats.uniqueCount * 2
}

export const compareValues = (left: unknown, right: unknown): number => {
  if (left == null && right == null) return 0
  if (left == null) return -1
  if (right == null) return 1
  if (typeof left === 'number' && typeof right === 'number') return left - right
  return String(left).localeCompare(String(right))
}

export const uniqueColumns = (columns: string[]): string[] => [...new Set(columns.filter(Boolean))]

export const partitionRows = (
  rows: Array<Record<string, unknown>>,
  groupBy?: string
): Array<Array<Record<string, unknown>>> => {
  if (!groupBy) return [rows]
  const map = new Map<string, Array<Record<string, unknown>>>()
  for (const row of rows) {
    const key = String(row[groupBy] ?? '')
    const list = map.get(key) ?? []
    list.push(row)
    map.set(key, list)
  }
  return [...map.values()]
}

export const AGGREGATE_OPS = ['mean', 'median', 'sum', 'min', 'max'] as const
export type AggregateOp = (typeof AGGREGATE_OPS)[number]

export const isAggregateOp = (value: string): value is AggregateOp =>
  (AGGREGATE_OPS as readonly string[]).includes(value)

/** Ordinal wellness / Likert-like metrics — summing across days is almost never meaningful. */
export const isRatingLikeColumn = (column: string): boolean =>
  /(?:^|_)(mood|soreness|fatigue|stress|sleep_quality|readiness|rpe|wellness)_?rating$|_rating$/i.test(
    column
  ) || /^(mood|body_soreness|sleep_quality|fatigue|stress|readiness)$/i.test(column)

const reduceAggregateValues = (values: number[], op: AggregateOp): number | null => {
  if (!values.length) return null
  if (op === 'sum') return round3(values.reduce((acc, n) => acc + n, 0))
  if (op === 'min') return round3(Math.min(...values))
  if (op === 'max') return round3(Math.max(...values))
  if (op === 'median') {
    const sorted = [...values].sort((a, b) => a - b)
    const mid = Math.floor(sorted.length / 2)
    return sorted.length % 2 === 1 ? sorted[mid]! : round3((sorted[mid - 1]! + sorted[mid]!) / 2)
  }
  return round3(values.reduce((acc, n) => acc + n, 0) / values.length)
}

export const aggregateDataset = (args: {
  dataset: PremiumDataset
  groupBy: string
  columns: string[]
  ops: AggregateOp[]
}): PremiumDataset => {
  const ops = args.ops.length ? args.ops : (['mean'] as AggregateOp[])
  const multiOp = ops.length > 1
  const valueColumns = args.columns.filter(
    (col) => args.dataset.columns.includes(col) && col !== args.groupBy
  )
  const outColumns = multiOp
    ? valueColumns.flatMap((col) => ops.map((op) => `${col}_${op}`))
    : valueColumns
  const groups = partitionRows(args.dataset.rows, args.groupBy)
  const rows = groups.flatMap((group) => {
    const key = group[0]?.[args.groupBy]
    if (key == null || String(key).trim() === '') return []
    const out: Record<string, unknown> = { [args.groupBy]: key, n: group.length }
    for (const col of valueColumns) {
      const values = group.map((row) => toNumber(row[col])).filter((n): n is number => n != null)
      for (const op of ops) {
        const effectiveOp: AggregateOp = op === 'sum' && isRatingLikeColumn(col) ? 'mean' : op
        out[multiOp ? `${col}_${op}` : col] = reduceAggregateValues(values, effectiveOp)
      }
    }
    return [out]
  })
  return {
    ...args.dataset,
    id: 'tmp',
    columns: uniqueColumns([args.groupBy, 'n', ...outColumns]),
    rows,
  }
}

export const pickDateColumn = (columns: string[]): string | undefined =>
  columns.find((column) => /^(date|date_of_day|jour|day)$/i.test(String(column).trim())) ??
  columns.find((column) => /date|jour/i.test(String(column)))

export const sortDatasetByDate = (dataset: PremiumDataset): PremiumDataset => {
  const dateColumn = pickDateColumn(dataset.columns)
  if (!dateColumn) return dataset
  return {
    ...dataset,
    rows: [...dataset.rows].sort((left, right) =>
      compareIsoDateKeys(left[dateColumn], right[dateColumn])
    ),
  }
}

export const trimDatasetRows = (
  dataset: PremiumDataset,
  maxRows: number
): { dataset: PremiumDataset; trimmedFrom?: number } => {
  if (maxRows < 1 || dataset.rows.length <= maxRows) return { dataset }
  const sorted = sortDatasetByDate(dataset)
  const dateColumn = pickDateColumn(sorted.columns)
  if (!dateColumn) {
    return {
      dataset: { ...sorted, rows: sorted.rows.slice(0, maxRows) },
      trimmedFrom: dataset.rows.length,
    }
  }

  const athleteColumn = pickAthleteColumn(sorted.columns)
  const groupColumn =
    athleteColumn ??
    sorted.columns.find((column) => /^(poste|position)$/i.test(column)) ??
    sorted.columns.find((column) => /poste|position/i.test(column))
  const groupCount = groupColumn
    ? new Set(sorted.rows.map((row) => String(row[groupColumn] ?? '').trim()).filter(Boolean)).size
    : 0

  if (groupCount > 1) {
    const dates = uniqueSortedIsoDates(sorted.rows.map((row) => row[dateColumn]))
    if (dates.length <= maxRows) return { dataset: sorted }
    const keep = new Set(dates.slice(-maxRows))
    return {
      dataset: {
        ...sorted,
        rows: sorted.rows.filter((row) => {
          const key = normalizeIsoDate(row[dateColumn])
          return key != null && keep.has(key)
        }),
      },
      trimmedFrom: dataset.rows.length,
    }
  }

  return {
    dataset: { ...sorted, rows: sorted.rows.slice(-maxRows) },
    trimmedFrom: dataset.rows.length,
  }
}

const densifyMaxOutputRows = (): number => PREMIUM_REPORT_MAX_DATASET_ROWS

export const densifyDailyDataset = (args: {
  dataset: PremiumDataset
  dateColumn: string
  groupBy?: string
  valueColumns: string[]
  from: string
  to: string
  missingValue?: number | null
}): PremiumDataset => {
  const { dataset, dateColumn, groupBy, valueColumns, from, to } = args
  const missingValue = args.missingValue === undefined ? null : args.missingValue
  const days = enumerateIsoDays(from, to)
  if (days.length === 0) return dataset
  const groups = partitionRows(dataset.rows, groupBy)
  if (days.length * groups.length > densifyMaxOutputRows()) return dataset
  const outRows: Array<Record<string, unknown>> = []
  for (const group of groups) {
    const byDate = new Map<string, Record<string, unknown>>()
    for (const row of group) {
      const key = toIsoDate(row[dateColumn])
      if (!key) continue
      const prev = byDate.get(key)
      if (!prev) {
        byDate.set(key, row)
        continue
      }
      for (const col of valueColumns) {
        const a = toNumber(prev[col])
        const b = toNumber(row[col])
        prev[col] = a == null ? b : b == null ? a : a + b
      }
    }
    const template = group[0] ?? {}
    for (const day of days) {
      const existing = byDate.get(day)
      if (existing) {
        existing[dateColumn] = day
        for (const col of valueColumns) {
          if (toNumber(existing[col]) == null) existing[col] = missingValue
        }
        outRows.push(existing)
        continue
      }
      const sparse: Record<string, unknown> = { [dateColumn]: day }
      if (groupBy) sparse[groupBy] = template[groupBy] ?? null
      for (const col of valueColumns) sparse[col] = missingValue
      outRows.push(sparse)
    }
  }
  dataset.rows = outRows
  dataset.columns = uniqueColumns([
    ...(groupBy ? [groupBy] : []),
    dateColumn,
    ...valueColumns,
    ...dataset.columns,
  ])
  return dataset
}

export const takeLatestRows = (
  dataset: PremiumDataset,
  groupBy: string,
  orderBy: string,
  keep?: string[]
): PremiumDataset => {
  const groups = partitionRows(dataset.rows, groupBy)
  const rows = groups.map((group) => {
    let last = group[0] ?? {}
    for (let i = 1; i < group.length; i++) {
      const row = group[i]!
      if (compareValues(row[orderBy], last[orderBy]) >= 0) last = row
    }
    if (!keep?.length) return { ...last }
    const out: Record<string, unknown> = { [groupBy]: last[groupBy] }
    for (const col of keep) out[col] = last[col] ?? null
    return out
  })
  const columns = keep?.length
    ? uniqueColumns([groupBy, ...keep])
    : uniqueColumns([groupBy, ...dataset.columns])
  return { id: 'tmp', columns, rows, ...copyMeta(dataset) }
}

export const rankTopRows = (
  rows: Array<Record<string, unknown>>,
  column: string,
  n: number,
  dir: 'asc' | 'desc' = 'desc'
): Array<Record<string, unknown>> => {
  const desc = dir !== 'asc'
  return [...rows]
    .filter((row) => toNumber(row[column]) != null)
    .sort((a, b) => {
      const av = toNumber(a[column]) ?? -Infinity
      const bv = toNumber(b[column]) ?? -Infinity
      return desc ? bv - av : av - bv
    })
    .slice(0, n)
}

export type FilterOp = 'ne' | 'eq' | 'gt' | 'gte' | 'lt' | 'lte' | 'not_null' | 'contains'

export const FILTER_OPS = [
  'ne',
  'eq',
  'gt',
  'gte',
  'lt',
  'lte',
  'not_null',
  'contains',
] as const satisfies readonly FilterOp[]

export const isFilterOp = (value: string): value is FilterOp =>
  (FILTER_OPS as readonly string[]).includes(value)

export const filterRows = (
  dataset: PremiumDataset,
  column: string,
  op: FilterOp,
  value?: number | string
): PremiumDataset => {
  const resolvedColumn = dataset.columns.includes(column)
    ? column
    : /date|jour|day/i.test(column)
      ? (pickDateColumn(dataset.columns) ?? column)
      : column
  const rows = dataset.rows.filter((row) => {
    const cell = row[resolvedColumn]
    if (op === 'not_null') return cell != null && String(cell).trim() !== ''

    if (typeof value === 'string' || op === 'contains') {
      const hay = String(cell ?? '')
        .trim()
        .toLowerCase()
      const needle = String(value ?? '')
        .trim()
        .toLowerCase()
      if (!needle) return false
      if (op === 'contains') return hay.includes(needle)
      if (op === 'eq') return hay === needle
      if (op === 'ne') return hay !== needle
      if (op === 'gte' || op === 'gt' || op === 'lte' || op === 'lt') {
        const cmp = hay.localeCompare(needle)
        if (op === 'gte') return cmp >= 0
        if (op === 'gt') return cmp > 0
        if (op === 'lte') return cmp <= 0
        return cmp < 0
      }
      return false
    }

    const num = toNumber(cell)
    if (num == null || typeof value !== 'number') return false
    if (op === 'gt') return num > value
    if (op === 'gte') return num >= value
    if (op === 'lt') return num < value
    if (op === 'lte') return num <= value
    if (op === 'eq') return num === value
    if (op === 'ne') return num !== value
    return false
  })
  const dateColumn = pickDateColumn(dataset.columns)
  const dates = dateColumn ? uniqueSortedIsoDates(rows.map((row) => row[dateColumn])) : []
  const dateRange =
    dates.length > 0 ? { from: dates[0]!, to: dates[dates.length - 1]! } : dataset.dateRange
  return {
    id: 'tmp',
    columns: dataset.columns,
    rows,
    ...copyMeta(dataset),
    ...(dateRange ? { dateRange } : {}),
  }
}

export const joinOnKeys = (datasets: PremiumDataset[], keys: string[]): PremiumDataset => {
  if (keys.length === 0) return datasets[0] ?? { id: 'tmp', columns: [], rows: [] }
  const map = new Map<string, Record<string, unknown>>()
  const columns = new Set<string>(keys)
  const units: Record<string, string> = {}
  const labels: Record<string, string> = {}
  for (const dataset of datasets) {
    for (const col of dataset.columns) columns.add(col)
    if (dataset.units) Object.assign(units, dataset.units)
    if (dataset.labels) Object.assign(labels, dataset.labels)
    for (const row of dataset.rows) {
      const composite = keys.map((key) => String(row[key] ?? '')).join('\0')
      const prev = map.get(composite)
      if (!prev) {
        map.set(composite, Object.assign({}, row))
        continue
      }
      Object.assign(prev, row)
    }
  }
  return {
    id: 'tmp',
    columns: [...columns],
    rows: [...map.values()],
    ...(Object.keys(units).length ? { units } : {}),
    ...(Object.keys(labels).length ? { labels } : {}),
  }
}

export const assertDatasetRowsCap = (rows: number): string | null =>
  rows > PREMIUM_REPORT_MAX_DATASET_ROWS
    ? `dataset has ${rows} rows (max ${PREMIUM_REPORT_MAX_DATASET_ROWS})`
    : null

export const correlateColumns = (
  rows: Array<Record<string, unknown>>,
  xColumn: string,
  yColumn: string,
  method: 'pearson' | 'spearman',
  minPairs: number
): { r: number | null; n: number } => {
  const xs: number[] = []
  const ys: number[] = []
  for (const row of rows) {
    const x = toNumber(row[xColumn])
    const y = toNumber(row[yColumn])
    if (x == null || y == null) continue
    xs.push(x)
    ys.push(y)
  }
  const n = xs.length
  if (n < minPairs) return { r: null, n }
  const r = method === 'spearman' ? pearson(rankValues(xs), rankValues(ys)) : pearson(xs, ys)
  return { r: r == null ? null : round3(r), n }
}

export const inferNumericColumns = (dataset: PremiumDataset, skip: string[] = []): string[] => {
  const skipSet = new Set(skip.map((column) => column.toLowerCase()))
  return dataset.columns.filter((column) => {
    if (skipSet.has(column.toLowerCase()) || IDENTITY_COLUMNS.has(column.toLowerCase())) {
      return false
    }
    return dataset.rows.some((row) => {
      const n = toNumber(row[column])
      return n != null && n !== 0
    })
  })
}

export const isIdColumnName = (column: string): boolean =>
  column === 'id' ||
  column === 'athlete_id' ||
  column === 'athleteId' ||
  column.toLowerCase().endsWith('_id')

export const isAggregateCountColumn = (column: string): boolean =>
  /^(n|count|row_count|nrows|n_rows)$/i.test(column.trim())

export const isLoadVolumeColumn = (column: string): boolean =>
  !isRatingLikeColumn(column) &&
  /srpe|session.?rpe|player.?load|\bdsl\b|internal.?load|training.?load/i.test(column)

export const dropEmptyMetricDays = (
  dataset: PremiumDataset,
  metricColumns?: string[]
): { dataset: PremiumDataset; dropped: number } => {
  const dateColumn = pickDateColumn(dataset.columns)
  const metrics =
    metricColumns?.filter((col) => dataset.columns.includes(col)) ??
    inferNumericColumns(dataset, dateColumn ? [dateColumn] : [])
  if (!metrics.length) return { dataset, dropped: 0 }
  const kept = dataset.rows.filter((row) =>
    metrics.some((col) => {
      const n = toNumber(row[col])
      return n != null && Number.isFinite(n)
    })
  )
  const dropped = dataset.rows.length - kept.length
  if (dropped <= 0) return { dataset, dropped: 0 }
  return {
    dataset: { ...dataset, rows: kept },
    dropped,
  }
}

const isEmptyMetricColumn = (dataset: PremiumDataset, column: string): boolean => {
  if (IDENTITY_COLUMNS.has(column.toLowerCase())) return false
  for (const row of dataset.rows) {
    const raw = row[column]
    const n = toNumber(raw)
    if (n != null) {
      if (n !== 0) return false
      continue
    }
    if (raw != null && String(raw).trim() !== '' && String(raw).trim() !== '—') return false
  }
  return true
}

export const pruneEmptyMetricColumns = (
  dataset: PremiumDataset
): { dataset: PremiumDataset; dropped: string[] } => {
  const dropped: string[] = []
  let columns = dataset.columns.filter((column) => {
    if (!isEmptyMetricColumn(dataset, column)) return true
    dropped.push(column)
    return false
  })

  if (columns.some((column) => column.toLowerCase() === 'unit')) {
    const metricColumns = columns.filter(
      (column) => !IDENTITY_COLUMNS.has(column.toLowerCase()) && column.toLowerCase() !== 'unit'
    )
    if (metricColumns.length > 1) {
      columns = columns.filter((column) => {
        if (column.toLowerCase() !== 'unit') return true
        dropped.push(column)
        return false
      })
    }
  }

  if (dropped.length === 0) return { dataset, dropped }
  const keep = new Set(columns)
  const imputed = dataset.imputed?.map((marks) => {
    if (!marks) return undefined
    const next: Record<string, string> = {}
    for (const [column, reason] of Object.entries(marks)) {
      if (keep.has(column)) next[column] = reason
    }
    return Object.keys(next).length ? next : undefined
  })
  const imputedExcludedCount = imputed?.reduce(
    (sum, row) => sum + (row ? Object.keys(row).length : 0),
    0
  )
  return {
    dataset: {
      id: dataset.id,
      columns,
      rows: dataset.rows.map((row) => {
        const next: Record<string, unknown> = {}
        for (const column of columns) next[column] = row[column]
        return next
      }),
      ...copyMeta(dataset, columns),
      ...(imputed?.some(Boolean) ? { imputed } : {}),
      ...(imputedExcludedCount ? { imputedExcludedCount } : {}),
    },
    dropped,
  }
}

const pearson = (xs: number[], ys: number[]): number | null => {
  const n = xs.length
  if (n < 2 || n !== ys.length) return null
  let sumX = 0
  let sumY = 0
  for (let i = 0; i < n; i++) {
    sumX += xs[i]!
    sumY += ys[i]!
  }
  const meanX = sumX / n
  const meanY = sumY / n
  let num = 0
  let denX = 0
  let denY = 0
  for (let i = 0; i < n; i++) {
    const dx = xs[i]! - meanX
    const dy = ys[i]! - meanY
    num += dx * dy
    denX += dx * dx
    denY += dy * dy
  }
  if (denX === 0 || denY === 0) return null
  return num / Math.sqrt(denX * denY)
}

const rankValues = (values: number[]): number[] => {
  const indexed = values.map((value, index) => ({ value, index }))
  indexed.sort((a, b) => a.value - b.value)
  const ranks = new Array<number>(values.length)
  let i = 0
  while (i < indexed.length) {
    let j = i
    while (j + 1 < indexed.length && indexed[j + 1]!.value === indexed[i]!.value) j++
    const avgRank = (i + j + 2) / 2
    for (let k = i; k <= j; k++) ranks[indexed[k]!.index] = avgRank
    i = j + 1
  }
  return ranks
}

const pad2 = (value: number): string => String(value).padStart(2, '0')

const formatUtcYmd = (year: number, month: number, day: number): string | null => {
  if (!Number.isFinite(year) || month < 1 || month > 12 || day < 1 || day > 31) return null
  const date = new Date(Date.UTC(year, month - 1, day))
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null
  }
  return `${year}-${pad2(month)}-${pad2(day)}`
}

const parseIsoDate = (value: string): Date | null => {
  const key = normalizeIsoDate(value)
  if (!key) return null
  const date = new Date(`${key}T00:00:00.000Z`)
  return Number.isNaN(date.getTime()) ? null : date
}

const formatIsoDate = (date: Date): string =>
  `${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}-${pad2(date.getUTCDate())}`

/**
 * Normalize any chart/SQL date cell to YYYY-MM-DD.
 * Accepts Date, ISO, and DD/MM(/YYYY) — never trust localeCompare on DD/MM labels.
 */
export const normalizeIsoDate = (value: unknown, yearHint?: number): string | null => {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return formatIsoDate(value)
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    const date = new Date(value)
    return Number.isNaN(date.getTime()) ? null : formatIsoDate(date)
  }
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed) return null

  const iso = /^(\d{4})-(\d{2})-(\d{2})(?:[T\s].*)?$/.exec(trimmed)
  if (iso) return formatUtcYmd(Number(iso[1]), Number(iso[2]), Number(iso[3]))

  const dmy = /^(\d{1,2})[/.-](\d{1,2})(?:[/.-](\d{2,4}))?$/.exec(trimmed)
  if (dmy) {
    const day = Number(dmy[1])
    const month = Number(dmy[2])
    let year = dmy[3] != null ? Number(dmy[3]) : yearHint
    if (year != null && year < 100) year += 2000
    if (year == null) return null
    return formatUtcYmd(year, month, day)
  }
  return null
}

const compareIsoDateKeys = (left: unknown, right: unknown): number => {
  const a = normalizeIsoDate(left)
  const b = normalizeIsoDate(right)
  if (a && b) return a < b ? -1 : a > b ? 1 : 0
  if (a) return -1
  if (b) return 1
  return String(left ?? '').localeCompare(String(right ?? ''))
}

export const uniqueSortedIsoDates = (
  values: unknown[],
  fallbackYear = new Date().getUTCFullYear()
): string[] => {
  const years = values
    .map((value) => normalizeIsoDate(value)?.slice(0, 4))
    .filter((year): year is string => Boolean(year))
    .map(Number)
  const yearHint =
    years.length > 0 ? years.sort((left, right) => left - right)[years.length - 1]! : fallbackYear

  const keys = new Set<string>()
  for (const value of values) {
    const key = normalizeIsoDate(value, yearHint)
    if (key) keys.add(key)
  }
  return [...keys].sort()
}

export const formatIsoDateLabel = (
  isoDate: string,
  language: 'fr' | 'en' = 'fr'
): string => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate)
  if (!match) return isoDate
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])))
  return date.toLocaleDateString(language === 'fr' ? 'fr-FR' : 'en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  })
}

const enumerateIsoDays = (from: string, to: string): string[] => {
  const start = parseIsoDate(from)
  const end = parseIsoDate(to)
  if (!start || !end || start > end) return []
  const days: string[] = []
  const cursor = new Date(start.getTime())
  while (cursor <= end) {
    days.push(formatIsoDate(cursor))
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }
  return days
}

const toIsoDate = (value: unknown): string | null => normalizeIsoDate(value)

export const looksLikeDateColumn = (column: string, dataset: PremiumDataset): boolean => {
  if (/date/i.test(column)) return true
  const sample = dataset.rows.slice(0, 5).map((row) => toIsoDate(row[column]))
  return sample.some((value) => value != null)
}
