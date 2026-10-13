import logger from '@adonisjs/core/services/logger'
import { PREMIUM_SQL_FAILURE_CAP } from '#constants/premium_report_domains'
import type { AgentTool } from '#contracts/agent'
import type { PremiumDataset, PremiumReportDocument } from '#contracts/premium_report'
import type { PremiumDomain } from '#constants/premium_report_domains'
import type { PremiumCanvasAsk } from '#constants/premium_report.constants'
import type { PremiumReportIntent } from '#constants/premium_report_intent'
import { storeDataset, datasetToolResult } from '#services/premium_report/dataset_ops'
import {
  toDisplayChartDataset,
  implausibleMetricWarning,
  type StaffHeatScale,
} from '#services/premium_report/premium_report_document'
import { elapsedSec, logPremiumSql } from '#services/premium_report/premium_report_log'
import { applyColumnMeta, columnMetaForNames } from '#services/premium_report/period_metric_units'
import type { AppLanguage } from '#utils/localize'

export type PremiumReportState = {
  document: PremiumReportDocument
  datasets: Map<string, PremiumDataset>
  lastInsertedId?: string
  defaultAfter: 'start' | 'end'
  dateRange: { from: string; to: string }
  displayRange?: { from: string; to: string }
  fetchRange?: { from: string; to: string }
  /** Union of display + domain windows + extra prompt periods — macros clamp to this. */
  coverRange?: { from: string; to: string }
  domainRanges?: Partial<Record<PremiumDomain, { from: string; to: string }>>
  /** Complete fetch map (same domain may appear twice with different windows/metrics). */
  fetchWindows?: Array<{
    domain: PremiumDomain
    from: string
    to: string
    metrics?: string[]
    label?: string
  }>
  clubId: string
  athleteIds: string[]
  language: AppLanguage
  heatScales?: StaffHeatScale[]
  sqlFailures: Map<string, number>
  blockSql: boolean
  toolHistory: Array<{ name: string; input: Record<string, unknown>; timestamp: number }>
  jevValidations: number
  jevBlocked: number
  requestPrompt: string
  coachPrompt?: string
  loadFlag?: string
  mustUseTools: boolean
  explanationAsk: boolean
  canvasAsk: PremiumCanvasAsk
  intent: PremiumReportIntent
  valdTestTypes?: string[]
  templateMetaCache: Map<string, { units: Record<string, string>; labels: Record<string, string> }>
  /** Soft edit: preserve prior canvas — block destructive tools unless canvasAsk=remove. */
  softPreserveCanvas?: boolean
  /**
   * Soft additive (new_viz|duplicate): forbid mutate/remove on these prior block ids.
   * Orthogonal to softAllowBlockIds (allowlist for micro_edit|reshape|remove).
   */
  softLockedBlockIds?: Set<string>
  /**
   * Soft scoped mutate (micro_edit|reshape|remove): when defined, only these block ids
   * may be updated/filtered/transformed/removed. Empty Set = fail-closed (reject all).
   * Undefined = unlocked (e.g. layoutRepair) or not in allowlist mode.
   */
  softAllowBlockIds?: Set<string>
  /** Optional per-run caps (defaults from PREMIUM_REPORT_MAX_*). */
  limits?: {
    maxCharts?: number
    maxBlocks?: number
    /** Full-staff: skip Jev caption gate on add_text (expert prose, not micro-captions). */
    skipTextCaptionJev?: boolean
    deterministicCaptionGate?: boolean
    requireLiveDatasetId?: boolean
    allowNutritionScope?: boolean
    groundedAthleteNames?: string[]
    individualLinesAsk?: boolean
    dropEmptyDaysDefault?: boolean
    markLineValuesDefault?: number[]
  }
}

export type PremiumTool = {
  schema: {
    name: string
    description: string
    input_schema: Record<string, unknown>
  }
  execute: (input: Record<string, unknown>) => Promise<string>
}

export const recordSqlFailure = (state: PremiumReportState, error: string): boolean => {
  const key = sqlFailureKey(error)
  const next = (state.sqlFailures.get(key) ?? 0) + 1
  state.sqlFailures.set(key, next)
  let total = 0
  for (const n of state.sqlFailures.values()) total += n
  if (!state.blockSql && (next >= PREMIUM_SQL_FAILURE_CAP || total >= PREMIUM_SQL_FAILURE_CAP)) {
    state.blockSql = true
    logger.warn(
      { key, count: next, total, clubId: state.clubId },
      'premium_report.sql_circuit_open'
    )
    return true
  }
  return state.blockSql
}

export const wrapQueryTool = (dbTool: AgentTool, state: PremiumReportState): PremiumTool => ({
  schema: dbTool.schema,
  execute: async (input) => {
    if (state.blockSql) {
      return JSON.stringify({
        error: 'SQL disabled. Use macros / apply_formula / canvas on existing datasetIds.',
        blockSql: true,
      })
    }
    if (state.explanationAsk) {
      return JSON.stringify({
        error: 'route.canvasAsk=explain — do not query. Answer from the canvas in chat.',
      })
    }
    const sql = typeof input.sql === 'string' ? input.sql : ''
    const started = Date.now()
    const raw = await dbTool.execute({ sql })
    const result = ingestQueryResult(state, raw, {
      durationSec: elapsedSec(started),
      sql,
      emptyAsRaw: true,
    })
    const parsed = safeParseObject(result)
    const datasetId = typeof parsed?.datasetId === 'string' ? parsed.datasetId : undefined
    const dataset = datasetId ? state.datasets.get(datasetId) : undefined
    if (dataset) {
      applyColumnMeta(dataset, await columnMetaForNames(state.clubId, dataset.columns))
    }
    return result
  },
})

export const ingestQueryResult = (
  state: PremiumReportState,
  raw: string,
  opts: {
    durationSec: number
    sql?: string
    templateId?: string
    emptyAsRaw?: boolean
  }
): string => {
  const parsed = parseLeadingJson(raw)
  const parsedObj = toObject(parsed)
  const rows = extractRowsFromParsed(parsed)
  const error = extractErrorFromParsed(parsed) ?? extractHintFromParsed(parsed)
  logPremiumSql({
    durationSec: opts.durationSec,
    rowCount: rows?.length ?? 0,
    error: error ?? undefined,
    sql: opts.sql ?? '',
    templateId: opts.templateId,
  })
  if (error) {
    recordSqlFailure(state, error)
    return JSON.stringify({
      error,
      ...(opts.templateId ? { templateId: opts.templateId } : {}),
      ...(parsedObj && !opts.templateId ? parsedObj : {}),
      ...(state.blockSql
        ? {
            blockSql: true,
            ...(opts.templateId
              ? {}
              : {
                  hint: 'Stop free SQL. Prefer fetch_* macros, then apply_formula / canvas tools.',
                }),
          }
        : {}),
    })
  }
  if (!rows || rows.length === 0) {
    if (opts.templateId) {
      const why =
        opts.templateId === 'vald_tests'
          ? 'No VALD rows in this window (Hamburg VALD starts mid-2026 — Dec/Mar often empty).'
          : opts.templateId === 'biomarkers_daily' || opts.templateId === 'biomarkers'
            ? 'No biomarker rows in the resolved SQL window (check date remap logs; Dec cmj_score may exist while March week is empty).'
            : 'Query returned 0 rows for this template/window.'
      return JSON.stringify({
        error: `No rows for template — ${why}`,
        templateId: opts.templateId,
        durationSec: opts.durationSec,
      })
    }
    return JSON.stringify({
      ...(parsedObj ?? (opts.emptyAsRaw ? { raw } : {})),
      durationSec: opts.durationSec,
    })
  }
  const columns = Object.keys(rows[0] ?? {})
  if (columns.length === 0) return raw
  const stored = rowsToDataset(state, rows)
  const metricWarning = implausibleMetricWarning(stored, state.dateRange)
  return datasetToolResult(stored, {
    durationSec: opts.durationSec,
    ...(opts.templateId ? { templateId: opts.templateId } : {}),
    note: stored.columns.includes('joueur')
      ? 'Use joueur as category (never id).'
      : 'Select first_name/last_name — ids cannot be charted.',
    ...(metricWarning ? { warning: metricWarning } : {}),
  })
}
const rowsToDataset = (
  state: PremiumReportState,
  rows: Array<Record<string, unknown>>
): PremiumDataset => {
  const columns = Object.keys(rows[0] ?? {})
  const display = toDisplayChartDataset({ id: 'tmp', columns, rows })
  return storeDataset(state, display)
}

export const safeParseObject = (raw: string): Record<string, unknown> | null =>
  toObject(parseLeadingJson(raw))

const sqlFailureKey = (error: string): string => {
  const e = error.toLowerCase()
  if (e.includes('blocked:') && (e.includes('unit') || e.includes('prefer macro'))) return 'unit'
  if (e.includes('only select') || e.includes('must start with select')) return 'select_only'
  if (e.includes('.unit') || e.includes('real .unit') || e.includes('fake unit')) return 'unit'
  if (e.includes('syntax') || e.includes('postgres')) return 'syntax'
  if (e.includes('does not exist') || e.includes('undefined column')) return 'column'
  if (e.includes('timeout') || e.includes('cancel')) return 'timeout'
  if (e.includes('permission') || e.includes('denied')) return 'permission'
  if (e.startsWith('blocked:')) return 'blocked'
  return e.replace(/\s+/g, ' ').slice(0, 80)
}

const toObject = (parsed: unknown): Record<string, unknown> | null => {
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null
  return parsed as Record<string, unknown>
}

const extractRowsFromParsed = (parsed: unknown): Array<Record<string, unknown>> | null => {
  if (!parsed) return null
  const rows = Array.isArray(parsed)
    ? parsed
    : parsed && typeof parsed === 'object' && Array.isArray((parsed as { rows?: unknown }).rows)
      ? (parsed as { rows: unknown[] }).rows
      : null
  if (!rows) return null
  const objects = rows.filter(
    (row): row is Record<string, unknown> =>
      Boolean(row) && typeof row === 'object' && !Array.isArray(row)
  )
  return objects.length > 0 ? objects : null
}

const extractErrorFromParsed = (parsed: unknown): string | null => {
  const obj = toObject(parsed)
  return typeof obj?.error === 'string' ? obj.error : null
}

const extractHintFromParsed = (parsed: unknown): string | null => {
  const obj = toObject(parsed)
  if (!obj) return null
  const hint = obj.partition_hint
  if (typeof hint !== 'string') return null
  return typeof obj.hint === 'string' ? `${hint}: ${obj.hint}` : hint
}

const parseLeadingJson = (raw: string): unknown => {
  const trimmed = raw.trim()
  try {
    return JSON.parse(trimmed)
  } catch {
    const newline = trimmed.search(/\n\s*\n|\nNOTICE:/)
    if (newline <= 0) return null
    try {
      return JSON.parse(trimmed.slice(0, newline))
    } catch {
      return null
    }
  }
}
