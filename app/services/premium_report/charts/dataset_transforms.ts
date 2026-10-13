import {
  PREMIUM_LINE_MAX_ATHLETES,
} from '#constants/premium_report.constants'
import { pickAthleteColumn } from '#constants/premium_report_metrics'
import type { PremiumDataset } from '#contracts/premium_report'
import { round3, toNumber } from '#services/premium_report/dataset_ops'
import { isPlainRecord, type EchartsOption } from '#services/premium_report/charts/echarts_types'

export const listDatasetAthletes = (dataset: PremiumDataset): string[] => {
  const column = pickAthleteColumn(dataset.columns)
  if (!column) return []
  return [
    ...new Set(dataset.rows.map((row) => String(row[column] ?? '').trim()).filter(Boolean)),
  ].sort((left, right) => left.localeCompare(right))
}

export const filterDatasetByAthletes = (
  dataset: PremiumDataset,
  athletes: string[]
): PremiumDataset => {
  const column = pickAthleteColumn(dataset.columns)
  if (!column || athletes.length === 0) return dataset
  const allow = new Set(athletes.map((name) => name.trim().toLowerCase()).filter(Boolean))
  if (allow.size === 0) return dataset
  return {
    ...dataset,
    rows: dataset.rows.filter((row) =>
      allow.has(
        String(row[column] ?? '')
          .trim()
          .toLowerCase()
      )
    ),
  }
}

export const chunkAthletes = (athletes: string[], size = PREMIUM_LINE_MAX_ATHLETES): string[][] => {
  const out: string[][] = []
  const step = Math.max(1, size)
  for (let i = 0; i < athletes.length; i += step) {
    out.push(athletes.slice(i, i + step))
  }
  return out
}

export const balancedChunks = <T>(items: T[], maxPerChunk: number): T[][] => {
  if (items.length === 0) return []
  const cap = Math.max(1, maxPerChunk)
  if (items.length <= cap) return [items]
  const chunkCount = Math.ceil(items.length / cap)
  const size = Math.ceil(items.length / chunkCount)
  const out: T[][] = []
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size))
  return out
}

export const uniqueColumnCount = (dataset: PremiumDataset, column: string): number =>
  new Set(dataset.rows.map((row) => String(row[column] ?? '').trim()).filter(Boolean)).size

export const isNumericColumn = (dataset: PremiumDataset, column: string): boolean =>
  dataset.rows.some((row) => toNumber(row[column]) != null)

export const aggregateRowsByCategory = (
  rows: Array<Record<string, unknown>>,
  category: string,
  valueColumns: string[]
): Array<Record<string, unknown>> => {
  const groups = new Map<string, Array<Record<string, unknown>>>()
  for (const row of rows) {
    const key = String(row[category] ?? '').trim() || '—'
    const list = groups.get(key) ?? []
    list.push(row)
    groups.set(key, list)
  }
  if ([...groups.values()].every((group) => group.length <= 1)) return rows

  return [...groups.entries()].map(([key, group]) => {
    const out: Record<string, unknown> = { [category]: key }
    for (const col of valueColumns) {
      const nums = group.map((row) => toNumber(row[col])).filter((n): n is number => n != null)
      out[col] =
        nums.length === 0 ? null : round3(nums.reduce((acc, n) => acc + n, 0) / nums.length)
    }
    return out
  })
}

const SCALE_SPLIT_RATIO = 10
const SERIES_STAT_SUFFIX_RE = /[_\s(-]*(?:mean|median|min|max|sum|moyenne|médiane|mediane)\)?$/i

const seriesMetricBase = (column: string): string =>
  column.replace(SERIES_STAT_SUFFIX_RE, '').trim().toLowerCase()

const isSameMetricBand = (columns: string[]): boolean => {
  if (columns.length < 2) return false
  const [first, ...rest] = columns.map(seriesMetricBase)
  return Boolean(first) && rest.every((base) => base === first)
}

export const splitSeriesByScale = (
  columns: string[],
  rows: Array<Record<string, unknown>>
): { primary: string[]; secondary: string[] } => {
  if (isSameMetricBand(columns)) return { primary: columns, secondary: [] }
  const colMaxes = columns.map((col) => {
    let max = 0
    for (const row of rows) {
      const n = toNumber(row[col])
      if (n != null && n > max) max = n
    }
    return { col, max }
  })
  const nonZero = colMaxes.filter(({ max }) => max > 0)
  if (nonZero.length < 2) return { primary: columns, secondary: [] }
  const minMax = Math.min(...nonZero.map(({ max }) => max))
  const maxMax = Math.max(...nonZero.map(({ max }) => max))
  if (maxMax / minMax <= SCALE_SPLIT_RATIO) return { primary: columns, secondary: [] }
  const cutoff = minMax * SCALE_SPLIT_RATIO
  return {
    primary: colMaxes.filter(({ max }) => max <= cutoff).map(({ col }) => col),
    secondary: colMaxes.filter(({ max }) => max > cutoff).map(({ col }) => col),
  }
}

export const recordsFromDatasetSource = (
  option: EchartsOption
): { columns: string[]; rows: Array<Record<string, unknown>> } | null => {
  const dataset = isPlainRecord(option.dataset) ? option.dataset : null
  const source = dataset && Array.isArray(dataset.source) ? dataset.source : null
  if (!source || source.length === 0) return null
  if (isPlainRecord(source[0])) {
    const rows = source.filter((row): row is Record<string, unknown> => isPlainRecord(row))
    const columns = rows[0] ? Object.keys(rows[0]) : []
    if (columns.length === 0 || rows.length === 0) return null
    return { columns, rows }
  }
  if (source.length < 2 || !Array.isArray(source[0])) return null
  const columns = source[0].map((col) => String(col ?? ''))
  const rows = source.slice(1).flatMap((row) => {
    if (!Array.isArray(row)) return []
    const record: Record<string, unknown> = {}
    for (let i = 0; i < columns.length; i++) record[columns[i]!] = row[i]
    return [record]
  })
  if (rows.length === 0) return null
  return { columns, rows }
}
