import type { PremiumDataset } from '#contracts/premium_report'
import type { AppLanguage } from '#utils/localize'
import { pickDateColumn, toNumber } from '#services/premium_report/dataset_ops'
import { isImputedCell } from '#services/report_v4/imputed_cells'
import { formatValueWithUnit } from '#services/report_v4/metrics/column_labels'

export { auditLiteralNumbersOutsideFacts } from '#services/report_v4/grounding_facts'

export type ReportFactOp =
  | 'count'
  | 'count_where'
  | 'sum'
  | 'mean'
  | 'min'
  | 'max'
  | 'last'
  | 'distinct'
  | 'delta'

export type ReportFactWhere = {
  column: string
  op: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte'
  value: string | number | boolean
}

export type ReportFact = {
  id: string
  value: number
  unit?: string
  sourceDatasetId: string
  column?: string
  op: ReportFactOp
  where?: ReportFactWhere
  filter?: ReportFactWhere
  label?: string
}

type ReportFactCatalogEntry = {
  id: string
  unit?: string
  label?: string
  sourceDatasetId: string
  op: ReportFactOp
  nature: ReportFactOp
  period?: { from?: string; to?: string }
}

const FACT_ID_RE = /^[a-z][a-z0-9_]*(?:\.[a-z0-9_]+)+$/i

export const isValidFactId = (id: string): boolean => FACT_ID_RE.test(id.trim())

const normalizeCell = (value: unknown): string | number | boolean | null => {
  if (value === null || value === undefined) return null
  if (typeof value === 'boolean') return value
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!trimmed) return null
    const n = toNumber(trimmed)
    if (n !== null) return n
    return trimmed
  }
  return String(value)
}

const compareWhere = (cell: unknown, where: ReportFactWhere): boolean => {
  const left = normalizeCell(cell)
  if (left === null) return false
  const right =
    typeof where.value === 'string' ||
    typeof where.value === 'number' ||
    typeof where.value === 'boolean'
      ? normalizeCell(where.value)
      : null
  if (right === null) return false
  if (where.op === 'eq')
    return left === right || String(left).toLowerCase() === String(right).toLowerCase()
  if (where.op === 'neq')
    return left !== right && String(left).toLowerCase() !== String(right).toLowerCase()
  if (typeof left !== 'number' || typeof right !== 'number') return false
  if (where.op === 'gt') return left > right
  if (where.op === 'gte') return left >= right
  if (where.op === 'lt') return left < right
  if (where.op === 'lte') return left <= right
  return false
}

export const computeFactValue = (args: {
  dataset: PremiumDataset
  op: ReportFactOp
  column?: string
  where?: ReportFactWhere
  filter?: ReportFactWhere
}): { ok: true; value: number } | { ok: false; error: string } => {
  const indexed = args.dataset.rows.map((row, index) => ({ row, index }))
  const filtered = args.filter
    ? indexed.filter(({ row }) => compareWhere(row[args.filter!.column], args.filter!))
    : indexed
  if (args.op === 'count') {
    return { ok: true, value: filtered.length }
  }
  if (args.op === 'count_where') {
    if (!args.where) return { ok: false, error: 'count_where requires where' }
    const whereCol = args.where.column
    return {
      ok: true,
      value: filtered.filter(
        ({ row, index }) =>
          !isImputedCell(args.dataset, index, whereCol) &&
          compareWhere(row[whereCol], args.where!)
      ).length,
    }
  }
  const column = args.column?.trim()
  if (!column) return { ok: false, error: 'column required for this op' }
  if (
    !args.dataset.columns.includes(column) &&
    filtered[0] &&
    !(column in filtered[0].row)
  ) {
    return { ok: false, error: `unknown column ${column}` }
  }
  const numbers = filtered
    .filter(({ index }) => !isImputedCell(args.dataset, index, column))
    .map(({ row }) => toNumber(row[column]))
    .filter((n): n is number => n !== null && Number.isFinite(n))
  if (args.op === 'distinct') {
    return { ok: true, value: new Set(numbers).size }
  }
  if (numbers.length === 0) return { ok: false, error: `no numeric values in ${column}` }
  if (args.op === 'sum') return { ok: true, value: numbers.reduce((a, b) => a + b, 0) }
  if (args.op === 'mean')
    return { ok: true, value: numbers.reduce((a, b) => a + b, 0) / numbers.length }
  if (args.op === 'min') return { ok: true, value: Math.min(...numbers) }
  if (args.op === 'max') return { ok: true, value: Math.max(...numbers) }
  if (args.op === 'last') {
    const dateCol = pickDateColumn(args.dataset.columns)
    const ordered = dateCol
      ? [...filtered].sort((left, right) =>
          String(left.row[dateCol] ?? '').localeCompare(String(right.row[dateCol] ?? ''))
        )
      : filtered
    for (let i = ordered.length - 1; i >= 0; i -= 1) {
      const entry = ordered[i]!
      if (isImputedCell(args.dataset, entry.index, column)) continue
      const n = toNumber(entry.row[column])
      if (n !== null && Number.isFinite(n)) return { ok: true, value: n }
    }
    return { ok: false, error: `no last value in ${column}` }
  }
  if (args.op === 'delta') {
    if (numbers.length < 2) return { ok: false, error: `need ≥2 values for delta in ${column}` }
    return { ok: true, value: Math.max(...numbers) - Math.min(...numbers) }
  }
  return { ok: false, error: `unsupported op ${args.op}` }
}

export const formatFactValue = (value: number, language: AppLanguage, unit?: string): string => {
  const abs = Math.abs(value)
  const digits = abs >= 100 || Number.isInteger(value) ? 0 : abs >= 10 ? 1 : 2
  const formatted = new Intl.NumberFormat(language === 'fr' ? 'fr-FR' : 'en-US', {
    maximumFractionDigits: digits,
    minimumFractionDigits: 0,
  }).format(value)
  return formatValueWithUnit({ valueText: formatted, unit, language })
}

const natureLabel = (op: ReportFactOp): string => {
  if (op === 'mean') return 'mean'
  if (op === 'max') return 'maximum'
  if (op === 'min') return 'minimum'
  if (op === 'sum') return 'total'
  if (op === 'last') return 'latest value'
  if (op === 'delta') return 'range (max−min)'
  if (op === 'count' || op === 'count_where') return 'count'
  if (op === 'distinct') return 'distinct count'
  return op
}

export const projectFactsForDesign = (facts: Iterable<ReportFact>): ReportFactCatalogEntry[] =>
  [...facts].map((fact) => ({
    id: fact.id,
    unit: fact.unit,
    label: fact.label ?? `${natureLabel(fact.op)}${fact.column ? ` of ${fact.column}` : ''}`,
    sourceDatasetId: fact.sourceDatasetId,
    op: fact.op,
    nature: fact.op,
  }))

export const injectDataFactsInHtml = (args: {
  html: string
  facts: Map<string, ReportFact> | Iterable<ReportFact>
  language: AppLanguage
}): { html: string; filled: number; missing: string[] } => {
  const byId =
    args.facts instanceof Map ? args.facts : new Map([...args.facts].map((fact) => [fact.id, fact]))
  const missing: string[] = []
  let filled = 0
  const html = args.html.replace(
    /<span\b([^>]*\bdata-fact=["']([^"']+)["'][^>]*)>([\s\S]*?)<\/span>/gi,
    (full, attrs: string, id: string, body: string) => {
      const fact = byId.get(id.trim())
      if (!fact) {
        missing.push(id.trim())
        return full
      }
      if (String(body ?? '').replace(/\s+/g, '').length > 0) {
        return full
      }
      filled += 1
      const text = formatFactValue(fact.value, args.language, fact.unit)
      const cleanAttrs = String(attrs).replace(/\s+data-fact-missing=["'][^"']*["']/i, '')
      return `<span${cleanAttrs}>${text}</span>`
    }
  )
  return { html, filled, missing: [...new Set(missing)] }
}

export const upsertFact = (registry: Map<string, ReportFact>, fact: ReportFact): void => {
  registry.set(fact.id, fact)
}
