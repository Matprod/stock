import type { PremiumDataset } from '#contracts/premium_report'
import {
  REPORT_V4_DATA_PROFILE_DEFAULT_SHARE,
  REPORT_V4_IMPUTED_SENTINELS,
} from '#services/report_v4/report_v4_constants'
import { toNumber } from '#services/premium_report/dataset_ops'

type SubjectiveScaleHint = {
  field: string
  label?: string
  min: number
  max: number
  higherIsBetter: boolean
}

type MarkImputedArgs = {
  datasets: Iterable<PremiumDataset>
  defaultShareThreshold?: number
  subjectiveScales?: SubjectiveScaleHint[]
}

export type ImputedMarkSummary = {
  excludedCellCount: number
  reasons: Record<string, number>
}

const IDENTITY_COL_RE =
  /^(joueur|player_key|athlete_id|athlete|date_of_day|date|poste|position|unit|n|jersey_number|gender|start_date|end_date|biomarker|metric|player|name|nom)$/i

const LOAD_ZERO_COL_RE =
  /srpe|session_rpe|internal_load|player_load|\bdsl\b|training_load|load_daily/i

const MINUTES_COL_RE =
  /^(minutes|duration_minutes|session_minutes|playing_minutes|minutes_played|match_minutes)$/i

const MATCH_DURATION_COL_RE =
  /match_duration|official_duration|match_minutes|fixture_minutes|scheduled_minutes/i

const foldScaleToken = (value: string): string =>
  value
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')

const matchSubjectiveScale = (
  column: string,
  scales?: SubjectiveScaleHint[]
): SubjectiveScaleHint | null => {
  if (!scales?.length) return null
  const col = foldScaleToken(column)
  if (col.length < 3) return null
  let best: SubjectiveScaleHint | null = null
  let bestLen = 0
  for (const scale of scales) {
    const field = foldScaleToken(scale.field)
    const stem = foldScaleToken(scale.field.replace(/_?rating$/i, ''))
    const label = foldScaleToken(scale.label ?? '')
    for (const token of [field, stem, label]) {
      if (token.length < 3) continue
      if (!col.includes(token) && !token.includes(col)) continue
      if (token.length > bestLen) {
        best = scale
        bestLen = token.length
      }
    }
  }
  return best
}

const isGoodEndOfScale = (value: number, scale: SubjectiveScaleHint): boolean =>
  scale.higherIsBetter ? value === scale.max : value === scale.min

const normalizeScalar = (value: unknown): string | number | boolean | null => {
  if (value === null || value === undefined) return null
  if (typeof value === 'boolean') return value
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!trimmed) return null
    if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
      const n = Number(trimmed)
      if (Number.isFinite(n)) return n
    }
    return trimmed
  }
  return String(value)
}

const scalarKey = (value: string | number | boolean | null): string =>
  typeof value === 'number' ? `n:${value}` : `s:${String(value)}`

const findMatchDurationColumn = (columns: string[]): string | undefined =>
  columns.find((column) => MATCH_DURATION_COL_RE.test(column))

const isRestDayLoadZero = (column: string, value: number): boolean =>
  LOAD_ZERO_COL_RE.test(column) && value === 0

const isMatchDurationMinutes = (
  column: string,
  value: number,
  row: Record<string, unknown>,
  matchDurationColumn?: string
): boolean => {
  if (!MINUTES_COL_RE.test(column)) return false
  if (!matchDurationColumn) return false
  const matchDuration = toNumber(row[matchDurationColumn])
  return matchDuration != null && matchDuration === value
}

const shouldExcludeLegitimate = (args: {
  column: string
  value: number
  row: Record<string, unknown>
  matchDurationColumn?: string
  subjectiveScales?: SubjectiveScaleHint[]
  forShareMode?: boolean
}): boolean => {
  if (isRestDayLoadZero(args.column, args.value)) return true
  if (
    isMatchDurationMinutes(
      args.column,
      args.value,
      args.row,
      args.matchDurationColumn
    )
  ) {
    return true
  }
  if (args.forShareMode) {
    const scale = matchSubjectiveScale(args.column, args.subjectiveScales)
    if (scale && isGoodEndOfScale(args.value, scale)) return true
  }
  return false
}

export const isImputedCell = (
  dataset: PremiumDataset,
  rowIndex: number,
  column: string
): boolean => Boolean(dataset.imputed?.[rowIndex]?.[column])

export const blankImputedCells = (dataset: PremiumDataset): PremiumDataset => {
  if (!dataset.imputed?.length) return dataset
  const rows = dataset.rows.map((row, rowIndex) => {
    const marks = dataset.imputed?.[rowIndex]
    if (!marks || Object.keys(marks).length === 0) return row
    const next = { ...row }
    for (const column of Object.keys(marks)) next[column] = null
    return next
  })
  return { ...dataset, rows }
}

const markColumnShareOrConstant = (args: {
  dataset: PremiumDataset
  column: string
  imputed: Array<Record<string, string> | undefined>
  defaultShareThreshold: number
  subjectiveScales?: SubjectiveScaleHint[]
  matchDurationColumn?: string
  reasonCounts: Record<string, number>
}): number => {
  const { dataset, column } = args
  const values = dataset.rows.map((row) => normalizeScalar(row[column]))
  const nonNullIndexes: number[] = []
  const counts = new Map<string, { count: number; value: string | number | boolean | null }>()
  for (let i = 0; i < values.length; i += 1) {
    const value = values[i]!
    if (value === null) continue
    nonNullIndexes.push(i)
    const key = scalarKey(value)
    const prev = counts.get(key)
    if (prev) prev.count += 1
    else counts.set(key, { count: 1, value })
  }
  if (nonNullIndexes.length < 5) return 0

  let mode: { count: number; value: string | number | boolean | null } | null = null
  for (const entry of counts.values()) {
    if (!mode || entry.count > mode.count) mode = entry
  }
  if (!mode || typeof mode.value !== 'number') return 0

  const constant = counts.size === 1
  const modeShare = mode.count / nonNullIndexes.length
  const scale = matchSubjectiveScale(column, args.subjectiveScales)
  const modeAtGoodEnd = scale ? isGoodEndOfScale(mode.value, scale) : false
  if (modeAtGoodEnd) return 0
  const suspiciousShare = !constant && modeShare > args.defaultShareThreshold
  if (!constant && !suspiciousShare) return 0

  const reason = constant
    ? `constant:${column}=${String(mode.value)}`
    : `suspicious_default:${column}=${String(mode.value)}@${Math.round(modeShare * 100)}%`

  let marked = 0
  for (const rowIndex of nonNullIndexes) {
    const value = values[rowIndex]
    if (value !== mode.value) continue
    const row = dataset.rows[rowIndex] ?? {}
    if (
      shouldExcludeLegitimate({
        column,
        value: mode.value,
        row,
        matchDurationColumn: args.matchDurationColumn,
        subjectiveScales: args.subjectiveScales,
        forShareMode: true,
      })
    ) {
      continue
    }
    const bucket = args.imputed[rowIndex] ?? {}
    if (bucket[column]) continue
    bucket[column] = reason
    args.imputed[rowIndex] = bucket
    args.reasonCounts[reason] = (args.reasonCounts[reason] ?? 0) + 1
    marked += 1
  }
  return marked
}

const markColumnSentinels = (args: {
  dataset: PremiumDataset
  column: string
  imputed: Array<Record<string, string> | undefined>
  matchDurationColumn?: string
  subjectiveScales?: SubjectiveScaleHint[]
  reasonCounts: Record<string, number>
}): number => {
  let marked = 0
  for (const sentinel of REPORT_V4_IMPUTED_SENTINELS) {
    if (!sentinel.column.test(args.column)) continue
    for (let rowIndex = 0; rowIndex < args.dataset.rows.length; rowIndex += 1) {
      const row = args.dataset.rows[rowIndex] ?? {}
      const value = toNumber(row[args.column])
      if (value === null || value !== sentinel.value) continue
      if (
        shouldExcludeLegitimate({
          column: args.column,
          value,
          row,
          matchDurationColumn: args.matchDurationColumn,
          subjectiveScales: args.subjectiveScales,
        })
      ) {
        continue
      }
      const bucket = args.imputed[rowIndex] ?? {}
      if (bucket[args.column]) continue
      bucket[args.column] = sentinel.reason
      args.imputed[rowIndex] = bucket
      args.reasonCounts[sentinel.reason] = (args.reasonCounts[sentinel.reason] ?? 0) + 1
      marked += 1
    }
  }
  return marked
}

export const markImputedCells = (args: MarkImputedArgs): ImputedMarkSummary => {
  const defaultShareThreshold =
    args.defaultShareThreshold ?? REPORT_V4_DATA_PROFILE_DEFAULT_SHARE
  const reasonCounts: Record<string, number> = {}
  let excludedCellCount = 0

  for (const dataset of args.datasets) {
    const columns =
      dataset.columns.length > 0
        ? dataset.columns
        : dataset.rows[0]
          ? Object.keys(dataset.rows[0])
          : []
    const metricColumns = columns.filter(
      (column) => !IDENTITY_COL_RE.test(column) && !MATCH_DURATION_COL_RE.test(column)
    )
    const matchDurationColumn = findMatchDurationColumn(columns)
    const imputed: Array<Record<string, string> | undefined> = Array.from(
      { length: dataset.rows.length },
      () => undefined
    )

    for (const column of metricColumns) {
      excludedCellCount += markColumnSentinels({
        dataset,
        column,
        imputed,
        matchDurationColumn,
        subjectiveScales: args.subjectiveScales,
        reasonCounts,
      })
      excludedCellCount += markColumnShareOrConstant({
        dataset,
        column,
        imputed,
        defaultShareThreshold,
        subjectiveScales: args.subjectiveScales,
        matchDurationColumn,
        reasonCounts,
      })
    }

    const hasMarks = imputed.some((row) => row && Object.keys(row).length > 0)
    dataset.imputed = hasMarks ? imputed : undefined
    const datasetCount = imputed.reduce(
      (sum, row) => sum + (row ? Object.keys(row).length : 0),
      0
    )
    dataset.imputedExcludedCount = datasetCount
  }

  return { excludedCellCount, reasons: reasonCounts }
}

export const formatImputedExclusionLine = (
  summary: ImputedMarkSummary,
  language: 'fr' | 'en'
): string | null => {
  if (summary.excludedCellCount <= 0) return null
  const topReasons = Object.entries(summary.reasons)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([reason, count]) => `${reason}×${count}`)
    .join('; ')
  if (language === 'fr') {
    return `Valeurs écartées : ${summary.excludedCellCount} cellule(s) imputée(s) ou sentinelle (${topReasons}).`
  }
  return `Excluded values: ${summary.excludedCellCount} imputed/sentinel cell(s) (${topReasons}).`
}
