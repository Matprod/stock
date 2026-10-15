import { PREMIUM_VALD_TEST_TYPES, normalizeCatalogIds } from '#constants/premium_report.constants'
import {
  PREMIUM_DOMAIN,
  PREMIUM_DOMAIN_CATALOG,
  type PremiumDomain,
} from '#constants/premium_report_domains'
import { pickAthleteColumn } from '#constants/premium_report_metrics'
import { applyFormulaColumnInPlace } from '#services/premium_report/apply_formula_op'
import {
  datasetToolResult,
  densifyDailyDataset,
  filterRows,
  resolveMacroDateRange,
  readString,
  readStringList,
  stampDatasetDateRange,
  stampDatasetDomain,
  storeDataset,
  toNumber,
} from '#services/premium_report/dataset_ops'
import {
  countPositiveLoad,
  pickLoadValueColumn,
  resolveLoadFormulaSpecs,
} from '#services/premium_report/load_summary_formulas'
import type { PremiumDataset } from '#contracts/premium_report'
import {
  buildPremiumSqlTemplate,
  PREMIUM_SQL_TEMPLATE,
  type PremiumSqlTemplateId,
} from '#services/premium_report/premium_report_sql_templates'
import {
  ingestQueryResult,
  safeParseObject,
  type PremiumReportState,
  type PremiumTool,
} from '#services/premium_report/premium_report_tools'
import { clubMetricCatalog } from '#services/premium_report/club_metric_catalog'
import {
  applyColumnMeta,
  columnMetaForNames,
  resolveTemplateColumnMeta,
} from '#services/premium_report/period_metric_units'
import { elapsedSec, logPremiumTool } from '#services/premium_report/premium_report_log'
import {
  formatCoachMetricBindings,
  preferredGpsMetricNames,
  preferredMatchMetricNames,
  preferredMatchSourceFromPrompt,
  resolveCoachMetricsFromCatalog,
} from '#services/report_v4/coach_metric_resolve'

type RunSql = (sql: string) => Promise<string>

export const createPremiumMacroTools = (args: {
  state: PremiumReportState
  runSql: RunSql
  domains: PremiumDomain[]
}): PremiumTool[] => {
  const tools: PremiumTool[] = []
  for (const domain of args.domains) {
    const config = PREMIUM_DOMAIN_CATALOG[domain]
    for (const macro of config.macros) {
      tools.push(
        sqlTemplateTool(
          args.state,
          args.runSql,
          macro.name,
          macro.templateId as PremiumSqlTemplateId,
          macro.description
        )
      )
    }
    if (config.loadSummary) tools.push(buildLoadSummaryTool(args.state, args.runSql))
  }
  return tools
}

const sqlTemplateTool = (
  state: PremiumReportState,
  runSql: RunSql,
  name: string,
  templateId: PremiumSqlTemplateId,
  description: string
): PremiumTool => {
  const isVald = templateId === PREMIUM_SQL_TEMPLATE.VALD_TESTS
  const knownTypes = PREMIUM_VALD_TEST_TYPES.map((entry) => entry.id).join(', ')
  return {
    schema: {
      name,
      description: isVald
        ? `${description}. Prefer over free query_database. Pass from/to (ISO) for this fetch window. Optional joueur="First Last". Optional testTypes=[${knownTypes}] (or aliases) — omit for all types.`
        : `${description}. Prefer over free query_database. Pass from/to (ISO) for this fetch window. Optional joueur="First Last" to keep one athlete.`,
      input_schema: {
        type: 'object',
        properties: {
          from: {
            type: 'string',
            pattern: '^\\d{4}-\\d{2}-\\d{2}$',
            description: 'ISO start date (YYYY-MM-DD) for THIS fetch window.',
          },
          to: {
            type: 'string',
            pattern: '^\\d{4}-\\d{2}-\\d{2}$',
            description: 'ISO end date (YYYY-MM-DD) for THIS fetch window.',
          },
          joueur: { type: 'string' },
          athleteIds: { type: 'array', items: { type: 'string' } },
          ...(isVald
            ? {
                testTypes: {
                  type: 'array',
                  items: { type: 'string' },
                  description: `Filter VALD test_type. Known ids: ${knownTypes}. Aliases ok (e.g. "counter movement").`,
                },
              }
            : {}),
        },
        required: ['from', 'to'],
      },
    },
    execute: async (input) => runTemplateQuery(state, runSql, templateId, input),
  }
}

const domainForTemplate = (templateId: PremiumSqlTemplateId): PremiumDomain | undefined => {
  switch (templateId) {
    case PREMIUM_SQL_TEMPLATE.DAILY_SRPE:
      return PREMIUM_DOMAIN.LOAD
    case PREMIUM_SQL_TEMPLATE.GPS_DISTANCE:
    case PREMIUM_SQL_TEMPLATE.GPS_INTENSITY:
    case PREMIUM_SQL_TEMPLATE.GPS_INTENSITY_DAILY:
      return PREMIUM_DOMAIN.GPS
    case PREMIUM_SQL_TEMPLATE.MATCH_STATS:
    case PREMIUM_SQL_TEMPLATE.MATCH_STATS_DAILY:
      return PREMIUM_DOMAIN.MATCH
    case PREMIUM_SQL_TEMPLATE.BIOMARKERS:
    case PREMIUM_SQL_TEMPLATE.BIOMARKERS_DAILY:
      return PREMIUM_DOMAIN.BIOMARKERS
    case PREMIUM_SQL_TEMPLATE.VALD_TESTS:
      return PREMIUM_DOMAIN.VALD
    case PREMIUM_SQL_TEMPLATE.BODY_METRICS:
      return PREMIUM_DOMAIN.BODY
    case PREMIUM_SQL_TEMPLATE.DAILY_SCORES:
      return PREMIUM_DOMAIN.SCORES
    case PREMIUM_SQL_TEMPLATE.INJURIES:
      return PREMIUM_DOMAIN.INJURY
    default:
      return undefined
  }
}

const resolveValdTestTypes = (
  state: PremiumReportState,
  input: Record<string, unknown>
): string[] | undefined => {
  const fromInput = normalizeCatalogIds(readStringList(input.testTypes), PREMIUM_VALD_TEST_TYPES)
  if (fromInput.length > 0) return fromInput
  return state.valdTestTypes
}
const buildLoadSummaryTool = (state: PremiumReportState, runSql: RunSql): PremiumTool => ({
  schema: {
    name: 'build_load_summary',
    description:
      'Daily internal load (default srpe_daily = RPE×minutes) densified + formulas inferred from the coach ask (EWMA / ACWR EWMA / monotony / strain / cumulative). Returns the DAILY frame as datasetId for line charts; summaryDatasetId = latest active-load bar/table. ACWR is never GPS. Pass from/to with ≥28d lookback when ACWR/EWMA28 is needed.',
    input_schema: {
      type: 'object',
      properties: {
        from: {
          type: 'string',
          pattern: '^\\d{4}-\\d{2}-\\d{2}$',
          description: 'ISO start (YYYY-MM-DD); include ≥28d lookback when computing EWMA/ACWR.',
        },
        to: {
          type: 'string',
          pattern: '^\\d{4}-\\d{2}-\\d{2}$',
          description: 'ISO end (YYYY-MM-DD) of the load window.',
        },
        dropZeroLoad: { type: 'boolean' },
        valueColumn: {
          type: 'string',
          description: 'Override load column (default: auto-detect srpe_daily).',
        },
      },
      required: ['from', 'to'],
    },
  },
  execute: async (input) => {
    const started = Date.now()
    const { from, to } = resolveMacroDateRange(state, PREMIUM_DOMAIN.LOAD, input)
    const dropZeroLoad = typeof input.dropZeroLoad === 'boolean' ? input.dropZeroLoad : true

    const dailyResult = await runTemplateQuery(state, runSql, PREMIUM_SQL_TEMPLATE.DAILY_SRPE, {
      from,
      to,
    })
    const dailyParsed = safeParseObject(dailyResult)
    if (dailyParsed?.error || !dailyParsed?.datasetId) return dailyResult
    const dailyId = String(dailyParsed.datasetId)
    const frame = state.datasets.get(dailyId)
    if (!frame) return JSON.stringify({ error: 'daily sRPE dataset missing after fetch' })

    const valueColumn = readString(input.valueColumn)?.trim() || pickLoadValueColumn(frame.columns)
    if (!frame.columns.includes(valueColumn)) {
      return JSON.stringify({
        error: `load value column "${valueColumn}" missing`,
        columns: frame.columns,
      })
    }
    const dateColumn = frame.columns.includes('date_of_day')
      ? 'date_of_day'
      : (frame.columns.find((c) => /date/i.test(c)) ?? 'date_of_day')
    const athleteColumn = pickAthleteColumn(frame.columns) ?? 'joueur'
    const specs = resolveLoadFormulaSpecs(state.coachPrompt ?? '', state.loadFlag)

    const positiveDays = countPositiveLoad(frame.rows, valueColumn, toNumber)
    if (positiveDays === 0) {
      const parsedSamples = frame.rows.slice(0, 8).map((row) => ({
        joueur: row.joueur ?? row.player,
        date: row.date_of_day,
        value: row[valueColumn],
        asNumber: toNumber(row[valueColumn]),
      }))
      const nullish = frame.rows.filter((row) => toNumber(row[valueColumn]) == null).length
      const zeroish = frame.rows.filter((row) => {
        const n = toNumber(row[valueColumn])
        return n != null && n <= 0
      }).length
      state.datasets.delete(dailyId)
      const durationSec = elapsedSec(started)
      const why =
        frame.rows.length === 0
          ? 'daily_srpe returned 0 rows'
          : `daily_srpe rows=${frame.rows.length} null=${nullish} zeroOrNeg=${zeroish} (sRPE=RPE×minutes — RPE may exist while minutes are 0, or values did not parse)`
      logPremiumTool({
        tool: 'build_load_summary',
        ok: false,
        durationSec,
        detail: `empty sRPE ${from}→${to} positive=0 — ${why}`,
      })
      return JSON.stringify({
        error: `No positive ${valueColumn} in ${from}→${to}. ${why}. Do NOT invent ACWR/EWMA/sRPE charts. Prefer GPS external load if session RPE×minutes is empty.`,
        empty: true,
        positiveLoadDays: 0,
        dateRange: { from, to },
        valueColumn,
        columns: frame.columns,
        sample: parsedSamples,
        rpe_sources: ['health_metrics', 'sport_activities', 'health_ratings'],
        durationSec,
      })
    }

    densifyDailyDataset({
      dataset: frame,
      dateColumn,
      groupBy: athleteColumn,
      valueColumns: [valueColumn],
      from,
      to,
      missingValue: null,
    })

    for (const spec of specs) {
      applyFormulaColumnInPlace({
        dataset: frame,
        valueColumn,
        groupBy: athleteColumn,
        orderBy: dateColumn,
        outputColumn: spec.outputColumn,
        formulaId: spec.id,
        params: spec.params,
      })
    }

    stampDatasetDateRange(frame, { from, to })
    stampDatasetDomain(frame, PREMIUM_DOMAIN.LOAD)
    const formulaDatasetIds = Object.fromEntries(specs.map((spec) => [spec.outputColumn, dailyId]))
    const keepCols = [athleteColumn, valueColumn, ...specs.map((spec) => spec.outputColumn)]
    let merged = takeLatestActiveLoadRows(frame, athleteColumn, dateColumn, valueColumn, keepCols)
    let dropNote: string | undefined
    if (dropZeroLoad) {
      const active = new Set(
        frame.rows
          .filter((row) => {
            const n = toNumber(row[valueColumn])
            return n != null && n > 0
          })
          .map((row) => String(row[athleteColumn] ?? ''))
      )
      const filteredRows = merged.rows.filter((row) => active.has(String(row[athleteColumn] ?? '')))
      if (filteredRows.length > 0) {
        merged.rows = filteredRows
      } else if (merged.rows.length > 0) {
        dropNote = `All latest ${valueColumn} were 0. Kept rows anyway.`
      }
    }
    const summary = stampDatasetDomain(
      stampDatasetDateRange(storeDataset(state, merged), { from, to }),
      PREMIUM_DOMAIN.LOAD
    )
    const durationSec = elapsedSec(started)
    const acwrColumn = specs.some((s) => s.outputColumn === 'acwr_ewma') ? 'acwr_ewma' : undefined
    logPremiumTool({
      tool: 'build_load_summary',
      ok: true,
      durationSec,
      detail: `daily=${dailyId} summary=${summary.id} rows=${frame.rows.length} positive=${positiveDays} formulas=${specs.map((s) => s.outputColumn).join(',') || 'none'} ${from}→${to}`,
    })
    return datasetToolResult(frame, {
      datasetId: dailyId,
      summaryDatasetId: summary.id,
      dailyDatasetId: dailyId,
      formulaDatasetIds,
      dateRange: { from, to },
      durationSec,
      loadVariable: valueColumn,
      loadVariableDef: `${valueColumn} (sRPE = Σ session RPE×minutes; RPE from sport_activities.rpe and/or health_ratings→health_metric_values *rpe|exertion|borg*; minutes from activity duration or GPS period duration)`,
      ...(acwrColumn ? { acwrColumn } : {}),
      formulasApplied: specs.map((s) => s.outputColumn),
      positiveLoadDays: positiveDays,
      note:
        dropNote ||
        `datasetId=${dailyId} is the DAILY frame (date_of_day + ${[valueColumn, ...specs.map((s) => s.outputColumn)].join(', ')}). Missing days are null (not 0). Line charts → this id. summaryDatasetId=${summary.id} for latest bar/table only. ACWR is on ${valueColumn}, never GPS.`,
    })
  },
})

const takeLatestActiveLoadRows = (
  frame: PremiumDataset,
  athleteColumn: string,
  dateColumn: string,
  valueColumn: string,
  keepCols: string[]
) => {
  const byAthlete = new Map<string, Array<Record<string, unknown>>>()
  for (const row of frame.rows) {
    const key = String(row[athleteColumn] ?? '')
    const bucket = byAthlete.get(key) ?? []
    bucket.push(row)
    byAthlete.set(key, bucket)
  }
  const rows: Array<Record<string, unknown>> = []
  for (const group of byAthlete.values()) {
    const ordered = [...group].sort((a, b) => {
      const av = String(a[dateColumn] ?? '')
      const bv = String(b[dateColumn] ?? '')
      return av < bv ? -1 : av > bv ? 1 : 0
    })
    let pick = ordered[ordered.length - 1] ?? {}
    for (let i = ordered.length - 1; i >= 0; i--) {
      const n = toNumber(ordered[i]![valueColumn])
      if (n != null && n > 0) {
        pick = ordered[i]!
        break
      }
    }
    const out: Record<string, unknown> = { [athleteColumn]: pick[athleteColumn] }
    for (const col of keepCols) {
      if (col === athleteColumn) continue
      out[col] = pick[col] ?? null
    }
    rows.push(out)
  }
  return {
    id: 'tmp',
    columns: keepCols.includes(athleteColumn) ? keepCols : [athleteColumn, ...keepCols],
    rows,
  } satisfies PremiumDataset
}

export const resolveMacroAthleteIds = (
  state: PremiumReportState,
  input: Record<string, unknown>
): string[] | undefined => {
  const allowed = state.athleteIds
  const inputIds = readStringList(input.athleteIds)
  if (!allowed.length) {
    return inputIds.length ? inputIds : undefined
  }
  const allowedSet = new Set(allowed)
  const filtered = (inputIds.length ? inputIds : allowed).filter((id) => allowedSet.has(id))
  if (filtered.length === 0 || filtered.length >= allowed.length) return undefined
  return filtered
}

const runTemplateQuery = async (
  state: PremiumReportState,
  runSql: RunSql,
  templateId: PremiumSqlTemplateId,
  input: Record<string, unknown>
): Promise<string> => {
  if (state.explanationAsk) {
    return JSON.stringify({
      error: 'route.canvasAsk=explain — do not fetch. Answer from the canvas in chat.',
    })
  }
  const requestedFrom = readString(input.from)
  const requestedTo = readString(input.to)
  const { from, to } = resolveMacroDateRange(state, domainForTemplate(templateId), input)
  if (
    requestedFrom &&
    requestedTo &&
    (requestedFrom !== from || requestedTo !== to)
  ) {
    logPremiumTool({
      tool: `fetch_${templateId}`,
      ok: true,
      durationSec: 0,
      detail: `date remap ${requestedFrom}→${requestedTo} ⇒ ${from}→${to}`,
    })
  }
  const testTypes =
    templateId === PREMIUM_SQL_TEMPLATE.VALD_TESTS ? resolveValdTestTypes(state, input) : undefined
  const isGpsIntensity =
    templateId === PREMIUM_SQL_TEMPLATE.GPS_INTENSITY_DAILY ||
    templateId === PREMIUM_SQL_TEMPLATE.GPS_INTENSITY
  const isMatchStats =
    templateId === PREMIUM_SQL_TEMPLATE.MATCH_STATS ||
    templateId === PREMIUM_SQL_TEMPLATE.MATCH_STATS_DAILY
  let preferredPeriodNames: string[] | undefined
  let preferredMatchNames: string[] | undefined
  let preferredMatchSource: string | undefined
  let coachMetricBindings: string | undefined
  const coachPrompt = state.coachPrompt?.trim() ?? ''
  if ((isGpsIntensity || isMatchStats) && coachPrompt) {
    const catalog = await clubMetricCatalog(state.clubId, {
      from: from,
      to: to,
    })
    const resolved = resolveCoachMetricsFromCatalog({
      prompt: coachPrompt,
      catalog,
    })
    if (isGpsIntensity) {
      preferredPeriodNames = preferredGpsMetricNames(resolved)
      coachMetricBindings = formatCoachMetricBindings(resolved) || undefined
    }
    if (isMatchStats) {
      preferredMatchNames = preferredMatchMetricNames(resolved)
      preferredMatchSource = preferredMatchSourceFromPrompt(coachPrompt)
      const matchBindings = formatCoachMetricBindings(
        resolved.filter((row) => row.source === 'match')
      )
      coachMetricBindings = matchBindings || undefined
    }
  }
  const sql = await buildPremiumSqlTemplate(templateId, {
    clubId: state.clubId,
    from,
    to,
    athleteIds: resolveMacroAthleteIds(state, input),
    testTypes,
    ...(preferredPeriodNames?.length ? { preferredPeriodNames } : {}),
    ...(preferredMatchNames?.length ? { preferredMatchNames } : {}),
    ...(preferredMatchSource ? { preferredMatchSource } : {}),
  })
  const started = Date.now()
  const raw = await runSql(sql)
  const result = ingestQueryResult(state, raw, {
    durationSec: elapsedSec(started),
    sql,
    templateId,
  })
  const parsed = safeParseObject(result)
  if (parsed?.error) {
    return JSON.stringify({
      ...parsed,
      dateRange: { from, to },
      ...(requestedFrom && requestedTo && (requestedFrom !== from || requestedTo !== to)
        ? { requestedRange: { from: requestedFrom, to: requestedTo } }
        : {}),
    })
  }
  if (parsed && !parsed.error && typeof parsed.datasetId === 'string') {
    let dataset = state.datasets.get(parsed.datasetId)
    if (dataset) {
      const macroDomain = domainForTemplate(templateId)
      stampDatasetDateRange(dataset, { from, to })
      stampDatasetDomain(dataset, macroDomain)
      parsed.dateRange = { from, to }
      let meta = state.templateMetaCache.get(templateId)
      if (!meta) {
        meta = await resolveTemplateColumnMeta(state.clubId, templateId)
        state.templateMetaCache.set(templateId, meta)
      }
      if (Object.keys(meta.units).length > 0) {
        dataset.units = { ...dataset.units, ...meta.units }
      }
      if (Object.keys(meta.labels).length > 0) {
        dataset.labels = { ...dataset.labels, ...meta.labels }
      }
      applyColumnMeta(dataset, await columnMetaForNames(state.clubId, dataset.columns))

      const joueur = readString(input.joueur)?.trim() ?? ''
      const athleteColumn = pickAthleteColumn(dataset.columns) ?? 'joueur'
      if (joueur && dataset.columns.includes(athleteColumn)) {
        const filtered = filterRows(dataset, athleteColumn, 'contains', joueur)
        if (filtered.rows.length === 0) {
          return JSON.stringify({
            error: `no rows for joueur containing "${joueur}"`,
            datasetId: parsed.datasetId,
            dateRange: { from, to },
            hint: 'Pass exact "First Last" or a unique last name',
          })
        }
        dataset = stampDatasetDomain(
          stampDatasetDateRange(storeDataset(state, filtered), { from, to }),
          macroDomain
        )
        parsed.datasetId = dataset.id
        parsed.rowCount = dataset.rows.length
        parsed.note = `Filtered to joueur~${joueur} (${dataset.rows.length} rows).`
      }

      if (templateId === PREMIUM_SQL_TEMPLATE.VALD_TESTS && dataset.columns.includes('test_type')) {
        const byType = splitValdByTestType(state, dataset)
        if (byType) {
          return JSON.stringify({
            ...parsed,
            datasetId: byType.primaryId,
            rowCount: state.datasets.get(byType.primaryId)?.rows.length ?? parsed.rowCount,
            note: byType.note,
            valdByTestType: byType.ids,
            ...(testTypes?.length ? { testTypes } : {}),
          })
        }
        if (testTypes?.length) {
          parsed.note = [
            typeof parsed.note === 'string' ? parsed.note : undefined,
            `Filtered VALD test_type ∈ ${testTypes.join(',')}.`,
          ]
            .filter(Boolean)
            .join(' ')
        }
      }
    }
    const unitsNote = datasetUnitsNote(state, String(parsed.datasetId))
    if (isGpsIntensity) {
      const baseNote =
        typeof parsed.note === 'string'
          ? parsed.note
          : 'GPS columns = this club period_metrics catalogue only. Prefer Abs distance columns (metres); do not invent pm.name outside the dataset.'
      return JSON.stringify({
        ...parsed,
        note: coachMetricBindings ? `${baseNote} Coach bindings: ${coachMetricBindings}` : baseNote,
        ...(preferredPeriodNames?.length ? { preferredPeriodNames } : {}),
        ...(unitsNote ? { units: unitsNote } : {}),
      })
    }
    if (isMatchStats) {
      const baseNote =
        typeof parsed.note === 'string'
          ? parsed.note
          : 'Match columns = sport_activity_metrics on game_activity only. Prefer fetch_match_stats_daily for trends.'
      return JSON.stringify({
        ...parsed,
        note: coachMetricBindings ? `${baseNote} Coach bindings: ${coachMetricBindings}` : baseNote,
        ...(preferredMatchNames?.length ? { preferredMatchNames } : {}),
        ...(preferredMatchSource ? { preferredMatchSource } : {}),
        ...(unitsNote ? { units: unitsNote } : {}),
      })
    }
    if (unitsNote) {
      return JSON.stringify({ ...parsed, units: unitsNote })
    }
    if (parsed.note) return JSON.stringify(parsed)
  }
  return result
}

const splitValdByTestType = (
  state: PremiumReportState,
  dataset: PremiumDataset
): { primaryId: string; ids: Record<string, string>; note: string } | null => {
  const types = [
    ...new Set(
      dataset.rows
        .map((row) =>
          String(row.test_type ?? '')
            .trim()
            .toUpperCase()
        )
        .filter(Boolean)
    ),
  ]
  if (types.length <= 1) return null
  const ids: Record<string, string> = {}
  for (const type of types) {
    const filtered = {
      ...dataset,
      rows: dataset.rows.filter(
        (row) =>
          String(row.test_type ?? '')
            .trim()
            .toUpperCase() === type
      ),
    }
    if (filtered.rows.length === 0) continue
    ids[type] = storeDataset(state, filtered).id
  }
  const primaryType = types[0]!
  const primaryId = ids[primaryType]
  if (!primaryId) return null
  const parts = Object.entries(ids).map(([type, id]) => `${type}=${id}`)
  return {
    primaryId,
    ids,
    note: `VALD split by test_type — use one table per type (do not mix CMJ/DJ/SLJ heat). ${parts.join(' | ')}`,
  }
}

const datasetUnitsNote = (
  state: PremiumReportState,
  datasetId: string
): Record<string, string> | undefined => {
  const units = state.datasets.get(datasetId)?.units
  return units && Object.keys(units).length > 0 ? units : undefined
}
