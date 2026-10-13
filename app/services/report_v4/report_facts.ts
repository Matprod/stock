import type { PremiumDataset } from '#contracts/premium_report'
import type { AppLanguage } from '#utils/localize'
import type { GroundingViolation } from '#services/report_v4/grounding_types'
import { toNumber } from '#services/premium_report/dataset_ops'

export type ReportFactOp = 'count' | 'count_where' | 'sum' | 'mean' | 'min' | 'max' | 'distinct'

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

export type ReportFactCatalogEntry = {
  id: string
  unit?: string
  label?: string
  sourceDatasetId: string
  op: ReportFactOp
}

const FACT_ID_RE = /^[a-z][a-z0-9]*(?:\.[a-z0-9_]+)+$/i
const ISO_DATE_RE = /\b\d{4}-\d{2}-\d{2}\b/g
const ISO_DATE_RANGE_RE =
  /\b\d{4}-\d{2}-\d{2}\s*(?:→|->|–|—|-|to|au|à)\s*\d{4}-\d{2}-\d{2}\b/gi
const SLASH_DATE_RE = /\b\d{1,2}\/\d{1,2}(?:\/\d{2,4})?\b/g
const MONTH_YEAR_RE =
  /\b(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?|janv(?:ier)?|févr(?:ier)?|fevr(?:ier)?|mars|avr(?:il)?|mai|juin|juil(?:let)?|août|aout|sept(?:embre)?|oct(?:obre)?|nov(?:embre)?|déc(?:embre)?|dec(?:embre)?)\s+20\d{2}\b/gi
const YEAR_TOKEN_RE = /\b20\d{2}\b/g
const CHART_HOST_RE = /\bchart_[a-z0-9_-]+\b/gi
const SECTION_NUM_RE = /\b(?:section|part|page|chart)\s*#?\s*\d+\b/gi
const ORDINAL_RE = /\b\d+(?:st|nd|rd|th)\b/gi
const LIST_INDEX_RE = /(?:^|[\s>])\d{1,2}[.)]\s/g
const UNIT_PAIR_RE =
  /\b\d+(?:[.,]\d+)?\s*(?:%|kg|cm|km|m|ms|s|min|h|u\/l|ul|bpm|au)\b/gi
const SCALE_RANGE_RE = /\b\d+\s*[-–—]\s*\d+\b/g

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
    typeof where.value === 'string' || typeof where.value === 'number' || typeof where.value === 'boolean'
      ? normalizeCell(where.value)
      : null
  if (right === null) return false
  if (where.op === 'eq') return left === right || String(left).toLowerCase() === String(right).toLowerCase()
  if (where.op === 'neq') return left !== right && String(left).toLowerCase() !== String(right).toLowerCase()
  if (typeof left !== 'number' || typeof right !== 'number') return false
  if (where.op === 'gt') return left > right
  if (where.op === 'gte') return left >= right
  if (where.op === 'lt') return left < right
  if (where.op === 'lte') return left <= right
  return false
}

const filterRows = (
  rows: Array<Record<string, unknown>>,
  filter?: ReportFactWhere
): Array<Record<string, unknown>> => {
  if (!filter) return rows
  return rows.filter((row) => compareWhere(row[filter.column], filter))
}

export const computeFactValue = (args: {
  dataset: PremiumDataset
  op: ReportFactOp
  column?: string
  where?: ReportFactWhere
  filter?: ReportFactWhere
}): { ok: true; value: number } | { ok: false; error: string } => {
  const rows = filterRows(args.dataset.rows, args.filter)
  if (args.op === 'count') {
    return { ok: true, value: rows.length }
  }
  if (args.op === 'count_where') {
    if (!args.where) return { ok: false, error: 'count_where requires where' }
    return {
      ok: true,
      value: rows.filter((row) => compareWhere(row[args.where!.column], args.where!)).length,
    }
  }
  const column = args.column?.trim()
  if (!column) return { ok: false, error: 'column required for this op' }
  if (!args.dataset.columns.includes(column) && rows[0] && !(column in rows[0])) {
    return { ok: false, error: `unknown column ${column}` }
  }
  const numbers = rows
    .map((row) => toNumber(row[column]))
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
  return { ok: false, error: `unsupported op ${args.op}` }
}

export const formatFactValue = (value: number, language: AppLanguage, unit?: string): string => {
  const abs = Math.abs(value)
  const digits = abs >= 100 || Number.isInteger(value) ? 0 : abs >= 10 ? 1 : 2
  const formatted = new Intl.NumberFormat(language === 'fr' ? 'fr-FR' : 'en-US', {
    maximumFractionDigits: digits,
    minimumFractionDigits: 0,
  }).format(value)
  if (!unit) return formatted
  return `${formatted}\u00a0${unit}`
}

export const projectFactsForDesign = (facts: Iterable<ReportFact>): ReportFactCatalogEntry[] =>
  [...facts].map((fact) => ({
    id: fact.id,
    unit: fact.unit,
    label: fact.label,
    sourceDatasetId: fact.sourceDatasetId,
    op: fact.op,
  }))

export const injectDataFactsInHtml = (args: {
  html: string
  facts: Map<string, ReportFact> | Iterable<ReportFact>
  language: AppLanguage
}): { html: string; filled: number; missing: string[] } => {
  const byId =
    args.facts instanceof Map
      ? args.facts
      : new Map([...args.facts].map((fact) => [fact.id, fact]))
  const missing: string[] = []
  let filled = 0
  const html = args.html.replace(
    /<span\b([^>]*\bdata-fact=["']([^"']+)["'][^>]*)>([\s\S]*?)<\/span>/gi,
    (full, attrs: string, id: string) => {
      const fact = byId.get(id.trim())
      if (!fact) {
        missing.push(id.trim())
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

const maskAllowedNumericContexts = (plain: string): string =>
  plain
    .replace(ISO_DATE_RANGE_RE, ' DATE_RANGE ')
    .replace(ISO_DATE_RE, ' DATE ')
    .replace(SLASH_DATE_RE, ' DATE ')
    .replace(MONTH_YEAR_RE, ' DATE ')
    .replace(YEAR_TOKEN_RE, ' YEAR ')
    .replace(CHART_HOST_RE, ' CHART ')
    .replace(SECTION_NUM_RE, ' SECTION ')
    .replace(ORDINAL_RE, ' ORD ')
    .replace(LIST_INDEX_RE, ' LIST ')
    .replace(UNIT_PAIR_RE, ' UNIT ')
    .replace(SCALE_RANGE_RE, ' SCALE ')

export const stripDataFactSpansForAudit = (html: string): string =>
  html.replace(/<span\b[^>]*\bdata-fact=["'][^"']+["'][^>]*>[\s\S]*?<\/span>/gi, ' ')

export const auditLiteralNumbersOutsideFacts = (html: string): GroundingViolation[] => {
  const withoutFacts = stripDataFactSpansForAudit(html)
  const plain = withoutFacts
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  if (!plain) return []
  const masked = maskAllowedNumericContexts(plain)
  const violations: GroundingViolation[] = []
  const tokenRe = /(?<![A-Za-z0-9_])(-?\d+(?:[.,]\d+)?)(?![A-Za-z0-9_])/g
  let match: RegExpExecArray | null
  while ((match = tokenRe.exec(masked)) !== null) {
    const raw = match[1] ?? ''
    const normalized = raw.replace(',', '.')
    const value = Number(normalized)
    if (!Number.isFinite(value)) continue
    violations.push({
      code: 'literal_number',
      message: 'Literal number in prose outside data-fact span',
      evidence: raw,
    })
  }
  return violations
}

export const upsertFact = (registry: Map<string, ReportFact>, fact: ReportFact): void => {
  registry.set(fact.id, fact)
}
