import { PREMIUM_DOMAIN, type PremiumDomain } from '#constants/premium_report_domains'
import { pickAthleteColumn } from '#constants/premium_report_metrics'
import {
  filterRows,
  resolveMacroDateRange,
  readString,
  stampDatasetDateRange,
  storeDataset,
} from '#services/premium_report/dataset_ops'
import {
  ingestQueryResult,
  safeParseObject,
  type PremiumReportState,
  type PremiumTool,
} from '#services/premium_report/premium_report_tools'
import { applyColumnMeta, columnMetaForNames } from '#services/premium_report/period_metric_units'
import { elapsedSec, logPremiumTool } from '#services/premium_report/premium_report_log'
import { resolveMacroAthleteIds } from '#services/premium_report/tools_macros'
import { sqlSleepDaily, sqlWellnessDaily } from '#services/report_v4/wellness_sleep_sql'

type RunSql = (sql: string) => Promise<string>

const resolveAthleteColumn = (columns: string[]): string => pickAthleteColumn(columns) ?? 'joueur'

export const createWellnessSleepMacroTools = (args: {
  state: PremiumReportState
  runSql: RunSql
  includeWellness: boolean
  includeSleep: boolean
}): PremiumTool[] => {
  const tools: PremiumTool[] = []
  if (args.includeWellness) {
    tools.push(
      makeMacroTool({
        state: args.state,
        runSql: args.runSql,
        name: 'fetch_wellness_daily',
        domain: PREMIUM_DOMAIN.WELLNESS,
        description:
          'Daily wellness (body_soreness, energy, mood, stress) per athlete. Pass from/to for THIS fetch window. If Fetch windows lists wellness twice (e.g. mood vs stress periods), call this macro once per window with those exact dates. Optional joueur="First Last".',
        buildSql: (range, athleteIds) =>
          sqlWellnessDaily({
            clubId: args.state.clubId,
            from: range.from,
            to: range.to,
            athleteIds,
          }),
      })
    )
  }
  if (args.includeSleep) {
    tools.push(
      makeMacroTool({
        state: args.state,
        runSql: args.runSql,
        name: 'fetch_sleep_daily',
        domain: PREMIUM_DOMAIN.SLEEP,
        description:
          'Daily sleep (quality, efficiency, consistency, hours) per athlete. Pass from/to for THIS fetch window. Optional joueur="First Last".',
        buildSql: (range, athleteIds) =>
          sqlSleepDaily({
            clubId: args.state.clubId,
            from: range.from,
            to: range.to,
            athleteIds,
          }),
      })
    )
  }
  return tools
}

const makeMacroTool = (args: {
  state: PremiumReportState
  runSql: RunSql
  name: string
  domain: PremiumDomain
  description: string
  buildSql: (range: { from: string; to: string }, athleteIds?: string[]) => string
}): PremiumTool => ({
  schema: {
    name: args.name,
    description: args.description,
    input_schema: {
      type: 'object',
      properties: {
        from: {
          type: 'string',
          pattern: '^\\d{4}-\\d{2}-\\d{2}$',
          description: 'ISO start (YYYY-MM-DD) for THIS fetch.',
        },
        to: {
          type: 'string',
          pattern: '^\\d{4}-\\d{2}-\\d{2}$',
          description: 'ISO end (YYYY-MM-DD) for THIS fetch.',
        },
        joueur: { type: 'string' },
        athleteIds: { type: 'array', items: { type: 'string' } },
      },
      required: ['from', 'to'],
    },
  },
  execute: async (input) => {
    if (args.state.explanationAsk) {
      return JSON.stringify({
        error: 'route.canvasAsk=explain — do not fetch. Answer from the canvas in chat.',
      })
    }
    const range = resolveMacroDateRange(args.state, args.domain, input)
    const athleteIds = resolveMacroAthleteIds(args.state, input)
    const sql = args.buildSql(range, athleteIds)
    const started = Date.now()
    const raw = await args.runSql(sql)
    const result = ingestQueryResult(args.state, raw, {
      durationSec: elapsedSec(started),
      sql,
      templateId: args.name,
    })
    const parsed = safeParseObject(result)
    if (parsed && !parsed.error && typeof parsed.datasetId === 'string') {
      let dataset = args.state.datasets.get(parsed.datasetId)
      if (dataset) {
        stampDatasetDateRange(dataset, range)
        parsed.dateRange = range
        applyColumnMeta(dataset, await columnMetaForNames(args.state.clubId, dataset.columns))
        const joueur = readString(input.joueur)?.trim() ?? ''
        const athleteColumn = resolveAthleteColumn(dataset.columns)
        if (joueur && dataset.columns.includes(athleteColumn)) {
          const filtered = filterRows(dataset, athleteColumn, 'contains', joueur)
          if (filtered.rows.length === 0) {
            return JSON.stringify({
              error: `no rows for joueur containing "${joueur}"`,
              datasetId: parsed.datasetId,
              dateRange: range,
            })
          }
          dataset = stampDatasetDateRange(storeDataset(args.state, filtered), range)
          parsed.datasetId = dataset.id
          parsed.rowCount = dataset.rows.length
        }
      }
      logPremiumTool({
        tool: args.name,
        ok: true,
        durationSec: elapsedSec(started),
        detail: `datasetId=${parsed.datasetId} ${range.from}→${range.to}`,
      })
      return JSON.stringify(parsed)
    }
    return result
  },
})
