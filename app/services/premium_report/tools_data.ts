import { PREMIUM_REPORT_LEAN_SAMPLE_ROWS } from '#constants/premium_report.constants'
import {
  PREMIUM_DOMAIN_CATALOG,
  type PremiumDomain,
} from '#constants/premium_report_domains'
import { pickAthleteColumn } from '#constants/premium_report_metrics'
import { elapsedSec } from '#services/premium_report/premium_report_log'
import { runVizGate } from '#services/premium_report/premium_report_viz_validator'
import {
  REPORT_FORMULA_IDS,
  type ReportFormulaId,
} from '#constants/report_builder.constants'
import type { PremiumDataset } from '#contracts/premium_report'
import {
  isReportFormulaId,
  type ReportFormulaParams,
} from '#services/report_v4/metrics/formulas'
import { applyFormulaOnDataset, FORMULAS_FILL_REST_DAYS } from '#services/premium_report/apply_formula_op'
import {
  assertDatasetRowsCap,
  commitDataset,
  correlateColumns,
  defaultGroupBy,
  densifyDailyDataset,
  filterRows,
  inferNumericColumns,
  joinOnKeys,
  looksLikeDateColumn,
  partitionRows,
  pickDateColumn,
  pruneEmptyMetricColumns,
  rankTopRows,
  readDateRange,
  readPositiveInt,
  readString,
  readStringList,
  requireDataset,
  requireDatasetColumns,
  resolveDatasetColumn,
  round3,
  takeLatestRows,
  toNumber,
  uniqueColumns,
  AGGREGATE_OPS,
  aggregateDataset,
  isAggregateOp,
  isLoadVolumeColumn,
  isRatingLikeColumn,
  FILTER_OPS,
  isFilterOp,
  parseFilterCompare,
  type AggregateOp,
} from '#services/premium_report/dataset_ops'
import type { PremiumReportState, PremiumTool } from '#services/premium_report/premium_report_tools'

const LEAN_TRANSFORM_RESULT = { sampleRows: 0 } as const
const LEAN_FILTER_RESULT = { sampleRows: PREMIUM_REPORT_LEAN_SAMPLE_ROWS } as const

export const createPremiumDataTools = (
  state: PremiumReportState,
  opts?: { domains?: PremiumDomain[] }
): PremiumTool[] => {
  const allowed = allowedFormulaIds(opts?.domains)
  return [
    buildFillDailyZerosTool(state),
    buildTakeLatestTool(state),
    buildFilterDatasetTool(state),
    buildDropEmptyColumnsTool(state),
    buildJoinDatasetsTool(state),
    buildAggregateDatasetTool(state),
    buildApplyFormulaTool(state, allowed),
    buildTransformColumnsTool(state),
    buildCorrelateTool(state),
  ]
}

export const allowedFormulaIds = (domains?: PremiumDomain[]): Set<ReportFormulaId> => {
  if (!domains?.length) return new Set(REPORT_FORMULA_IDS)
  const ids = new Set<ReportFormulaId>()
  for (const domain of domains) {
    for (const id of PREMIUM_DOMAIN_CATALOG[domain].formulaIds) ids.add(id)
  }
  return ids.size > 0 ? ids : new Set(REPORT_FORMULA_IDS)
}

const resolveAggregateGroupBy = (
  dataset: PremiumDataset,
  requested: string | undefined
): string | undefined => {
  if (!requested) {
    return (
      pickDateColumn(dataset.columns) ??
      dataset.columns.find((col) => /poste|position/i.test(col))
    )
  }
  return dataset.columns.find(
    (col) => col === requested || col.toLowerCase() === requested.toLowerCase()
  )
}

const defaultAggregateOps = (groupBy: string, valueColumns: string[]): AggregateOp[] => {
  const athleteGrouped = Boolean(
    pickAthleteColumn([groupBy]) || /^(joueur|player|athlete|athlete_name|name)$/i.test(groupBy)
  )
  const dateGrouped = Boolean(pickDateColumn([groupBy]))
  if (athleteGrouped && !dateGrouped && valueColumns.some((col) => isLoadVolumeColumn(col))) {
    return ['sum']
  }
  return ['mean']
}

const readAggregateOps = (
  input: Record<string, unknown>,
  fallback: AggregateOp[] = ['mean']
): AggregateOp[] => {
  const fromList = readStringList(input.ops).filter(isAggregateOp)
  if (fromList.length) return [...new Set(fromList)]
  const single = readString(input.op)
  if (single && isAggregateOp(single)) return [single]
  return fallback
}

const buildAggregateDatasetTool = (state: PremiumReportState): PremiumTool => ({
  schema: {
    name: 'aggregate_dataset',
    description:
      'Group by a key and reduce numeric columns. op=mean|median|sum|min|max, or ops=[mean,min,max] (suffixes columns e.g. value_mean). For athlete-grouped sRPE / player load / DSL totals default op=sum. For *_rating / mood / soreness / sleep_quality always use mean (never sum across days). Column n is row count only — never chart it as the load metric.',
    input_schema: {
      type: 'object',
      properties: {
        datasetId: { type: 'string' },
        groupBy: { type: 'string' },
        columns: { type: 'array', items: { type: 'string' } },
        op: { type: 'string', enum: [...AGGREGATE_OPS] },
        ops: { type: 'array', items: { type: 'string', enum: [...AGGREGATE_OPS] } },
      },
      required: ['datasetId'],
    },
  },
  execute: async (input) => {
    const dataset = requireDataset(state, input)
    if (typeof dataset === 'string') return dataset
    const requestedGroupBy = readString(input.groupBy)
    if (requestedGroupBy) {
      const groupError = requireDatasetColumns(dataset, [requestedGroupBy])
      if (groupError) return groupError
    }
    const groupBy = resolveAggregateGroupBy(dataset, requestedGroupBy)
    if (!groupBy) {
      return JSON.stringify({
        error: 'groupBy required and must exist',
        available_columns: dataset.columns,
        hint: 'Pass an existing column as groupBy',
      })
    }
    const requested = readStringList(input.columns)
    if (requested.length) {
      const colError = requireDatasetColumns(dataset, requested)
      if (colError) return colError
    }
    const valueColumns = (
      requested.length
        ? requested
            .map((col) => resolveDatasetColumn(dataset, col)!)
            .filter((col) => col !== groupBy)
        : inferNumericColumns(dataset, [groupBy])
    ).slice(0, 12)
    if (!valueColumns.length) {
      return JSON.stringify({
        error: 'no numeric columns to aggregate',
        available_columns: dataset.columns,
      })
    }
    const ops = readAggregateOps(input, defaultAggregateOps(groupBy, valueColumns))
    const multiOp = ops.length > 1

    const next = aggregateDataset({ dataset, groupBy, columns: valueColumns, ops })
    const coercedToMean = valueColumns.filter(
      (col) => ops.includes('sum') && isRatingLikeColumn(col)
    )
    const outColumns = next.columns.filter((col) => col !== groupBy && col !== 'n')

    const mapMeta = (source: Record<string, string> | undefined, withSuffix: boolean) => {
      if (!source) return undefined
      const mapped = Object.fromEntries(
        outColumns.flatMap((outCol) => {
          const base = valueColumns.find((col) => outCol === col || outCol.startsWith(`${col}_`))
          const value = base ? source[base] : undefined
          if (!value || !base) return []
          if (!withSuffix || !multiOp) return [[outCol, value] as const]
          return [[outCol, `${value} (${outCol.slice(base.length + 1)})`] as const]
        })
      )
      return Object.keys(mapped).length ? mapped : undefined
    }

    const units = mapMeta(dataset.units, false)
    const labels = mapMeta(dataset.labels, true)
    const capped: PremiumDataset = {
      ...next,
      ...(units ? { units } : {}),
      ...(labels ? { labels } : {}),
    }
    const capError = assertDatasetRowsCap(capped.rows.length)
    if (capError) return JSON.stringify({ error: capError })
    return commitDataset(state, capped, {
      ops,
      groupBy,
      columns: valueColumns,
      ...(coercedToMean.length
        ? { note: `sum→mean for rating columns: ${coercedToMean.join(', ')}` }
        : {}),
    })
  },
})

const buildApplyFormulaTool = (
  state: PremiumReportState,
  allowed: Set<ReportFormulaId>
): PremiumTool => {
  const ids = [...allowed]
  return {
    schema: {
      name: 'apply_formula',
      description: 'Apply formula (ewma/monotony/strain/acwr/zscore/…). Returns new datasetId.',
      input_schema: {
        type: 'object',
        properties: {
          id: { type: 'string', enum: ids },
          datasetId: { type: 'string' },
          valueColumn: { type: 'string' },
          groupBy: { type: 'string' },
          orderBy: { type: 'string' },
          outputColumn: { type: 'string' },
          fillRestDays: { type: 'boolean' },
          n: { type: 'number' },
          acute: { type: 'number' },
          chronic: { type: 'number' },
          uncoupled: { type: 'boolean' },
          minPoints: { type: 'number' },
          minSd: { type: 'number' },
        },
        required: ['id', 'datasetId', 'valueColumn'],
      },
    },
    execute: async (input) => {
      const idRaw = readString(input.id)
      if (!idRaw || !isReportFormulaId(idRaw) || !allowed.has(idRaw)) {
        return JSON.stringify({ error: 'invalid or disallowed formula id', allowed: ids })
      }
      const valueColumn = readString(input.valueColumn)
      if (!readString(input.datasetId) || !valueColumn) {
        return JSON.stringify({ error: 'datasetId and valueColumn are required' })
      }
      const dataset = requireDataset(state, input)
      if (typeof dataset === 'string') return dataset
      if (!dataset.columns.includes(valueColumn)) {
        return JSON.stringify({ error: `column "${valueColumn}" not in dataset`, columns: dataset.columns })
      }
      const groupBy = defaultGroupBy(dataset, readString(input.groupBy))
      const orderBy = readString(input.orderBy)
      const outputColumn = readString(input.outputColumn) ?? idRaw
      const fillRestDays =
        typeof input.fillRestDays === 'boolean' ? input.fillRestDays : undefined
      const params = readFormulaParams(input)
      const started = Date.now()
      const next = applyFormulaOnDataset({
        dataset,
        valueColumn,
        groupBy,
        orderBy,
        outputColumn,
        formulaId: idRaw,
        params,
        fillRestDays,
        dateRange: state.dateRange,
      })
      const didFill =
        (fillRestDays ?? FORMULAS_FILL_REST_DAYS.has(idRaw)) &&
        Boolean(orderBy && looksLikeDateColumn(orderBy, dataset))
      return commitDataset(state, next, {
        formula: idRaw,
        filledRestDays: didFill,
        durationSec: elapsedSec(started),
      })
    },
  }
}

const buildTransformColumnsTool = (state: PremiumReportState): PremiumTool => ({
  schema: {
    name: 'transform_columns',
    description:
      'Row math: recipe=scale|srpe|relative_intensity|vmax_exposure or op=add|sub|mul|div.',
    input_schema: {
      type: 'object',
      properties: {
        datasetId: { type: 'string' },
        recipe: {
          type: 'string',
          enum: ['scale', 'srpe', 'relative_intensity', 'vmax_exposure'],
        },
        column: { type: 'string' },
        factor: { type: 'number' },
        op: { type: 'string', enum: ['add', 'sub', 'mul', 'div'] },
        leftColumn: { type: 'string' },
        rightColumn: { type: 'string' },
        rpeColumn: { type: 'string' },
        minutesColumn: { type: 'string' },
        durationSecondsColumn: { type: 'string' },
        numeratorColumn: { type: 'string' },
        speedColumn: { type: 'string' },
        vmaxColumn: { type: 'string' },
        outputColumn: { type: 'string' },
      },
      required: ['datasetId'],
    },
  },
  execute: async (input) => {
    const dataset = requireDataset(state, input)
    if (typeof dataset === 'string') return dataset
    const recipe = readString(input.recipe)
    const op = readString(input.op)
    const started = Date.now()

    const recipeResult = recipe ? applyTransformRecipe(dataset, recipe, input) : null
    if (typeof recipeResult === 'string') return recipeResult

    let outCol: string | undefined
    let rows: Array<Record<string, unknown>>

    if (recipeResult) {
      outCol = recipeResult.outCol
      rows = recipeResult.rows
    } else if (op && ['add', 'sub', 'mul', 'div'].includes(op)) {
      const left = readString(input.leftColumn)
      const right = readString(input.rightColumn)
      if (!left || !right) {
        return JSON.stringify({ error: 'leftColumn and rightColumn required for op' })
      }
      const colError = requireDatasetColumns(dataset, [left, right])
      if (colError) return colError
      outCol = readString(input.outputColumn) ?? `${left}_${op}_${right}`
      rows = dataset.rows.map((row) => {
        const a = toNumber(row[left])
        const b = toNumber(row[right])
        let value: number | null = null
        if (a != null && b != null) {
          if (op === 'add') value = a + b
          else if (op === 'sub') value = a - b
          else if (op === 'mul') value = a * b
          else if (b !== 0) value = a / b
        }
        return { ...row, [outCol!]: value == null ? null : round3(value) }
      })
    } else {
      return JSON.stringify({
        error: 'Pass recipe=scale|srpe|relative_intensity|vmax_exposure or op=add|sub|mul|div',
      })
    }

    if (!outCol) return JSON.stringify({ error: 'outputColumn required' })
    const columns = dataset.columns.includes(outCol) ? dataset.columns : [...dataset.columns, outCol]
    const next: PremiumDataset = {
      id: 'tmp',
      columns,
      rows,
      ...(dataset.units ? { units: dataset.units } : {}),
      ...(dataset.labels ? { labels: dataset.labels } : {}),
    }
    return commitDataset(state, next, {
      transform: recipe ?? op,
      outputColumn: outCol,
      durationSec: elapsedSec(started),
    })
  },
})

const rowMinutes = (
  row: Record<string, unknown>,
  minCol: string,
  durCol: string
): number | null => {
  const minutesFromDur = toNumber(row[durCol])
  return toNumber(row[minCol]) ?? (minutesFromDur != null ? minutesFromDur / 60 : null)
}

const mapOut = (
  dataset: PremiumDataset,
  outCol: string,
  compute: (row: Record<string, unknown>) => number | null
) => ({
  outCol,
  rows: dataset.rows.map((row) => ({ ...row, [outCol]: compute(row) })),
})

const requireDurationSource = (
  dataset: PremiumDataset,
  minCol: string,
  durCol: string
): string | null => {
  const hasMin = dataset.columns.some(
    (col) => col === minCol || col.toLowerCase() === minCol.toLowerCase()
  )
  const hasDur = dataset.columns.some(
    (col) => col === durCol || col.toLowerCase() === durCol.toLowerCase()
  )
  if (hasMin || hasDur) return null
  return requireDatasetColumns(dataset, [minCol])
}

const applyTransformRecipe = (
  dataset: PremiumDataset,
  recipe: string,
  input: Record<string, unknown>
): { outCol: string; rows: Array<Record<string, unknown>> } | string | null => {
  if (recipe === 'srpe') {
    const rpeCol = readString(input.rpeColumn) ?? 'rpe'
    const minCol = readString(input.minutesColumn) ?? 'minutes'
    const durCol = readString(input.durationSecondsColumn) ?? 'duration_seconds'
    const colError =
      requireDatasetColumns(dataset, [rpeCol]) ?? requireDurationSource(dataset, minCol, durCol)
    if (colError) return colError
    return mapOut(dataset, readString(input.outputColumn) ?? 'srpe', (row) => {
      const rpe = toNumber(row[rpeCol])
      const minutes = rowMinutes(row, minCol, durCol)
      return rpe == null || minutes == null ? null : round3(rpe * minutes)
    })
  }
  if (recipe === 'relative_intensity') {
    const numCol = readString(input.numeratorColumn)
    if (!numCol) return JSON.stringify({ error: 'numeratorColumn required' })
    const minCol = readString(input.minutesColumn) ?? 'minutes'
    const durCol = readString(input.durationSecondsColumn) ?? 'duration_seconds'
    const colError =
      requireDatasetColumns(dataset, [numCol]) ?? requireDurationSource(dataset, minCol, durCol)
    if (colError) return colError
    return mapOut(dataset, readString(input.outputColumn) ?? 'relative_intensity', (row) => {
      const num = toNumber(row[numCol])
      const minutes = rowMinutes(row, minCol, durCol)
      return num == null || minutes == null || minutes === 0 ? null : round3(num / minutes)
    })
  }
  if (recipe === 'vmax_exposure') {
    const speedCol = readString(input.speedColumn)
    const vmaxCol = readString(input.vmaxColumn)
    if (!speedCol || !vmaxCol) return JSON.stringify({ error: 'speedColumn and vmaxColumn required' })
    const colError = requireDatasetColumns(dataset, [speedCol, vmaxCol])
    if (colError) return colError
    return mapOut(dataset, readString(input.outputColumn) ?? 'vmax_rel_pct', (row) => {
      const speed = toNumber(row[speedCol])
      const vmax = toNumber(row[vmaxCol])
      return speed == null || vmax == null || vmax === 0 ? null : round3((100 * speed) / vmax)
    })
  }
  if (recipe === 'scale') {
    const srcCol = readString(input.column) ?? readString(input.leftColumn)
    const factor = toNumber(input.factor)
    if (!srcCol) return JSON.stringify({ error: 'column required for recipe=scale' })
    if (factor == null) return JSON.stringify({ error: 'factor required (e.g. 0.001 for m→km)' })
    const colError = requireDatasetColumns(dataset, [srcCol])
    if (colError) return colError
    return mapOut(dataset, readString(input.outputColumn) ?? `${srcCol}_scaled`, (row) => {
      const v = toNumber(row[srcCol])
      return v == null ? null : round3(v * factor)
    })
  }
  return null
}
const buildCorrelateTool = (state: PremiumReportState): PremiumTool => ({
  schema: {
    name: 'correlate',
    description: 'Pearson/Spearman. mode=matrix → heatmap rows; mode=pair → one r.',
    input_schema: {
      type: 'object',
      properties: {
        datasetId: { type: 'string' },
        mode: { type: 'string', enum: ['matrix', 'pair'] },
        method: { type: 'string', enum: ['pearson', 'spearman'] },
        columns: { type: 'array', items: { type: 'string' } },
        xColumn: { type: 'string' },
        yColumn: { type: 'string' },
        groupBy: { type: 'string' },
        minPairs: { type: 'number' },
        outputColumn: { type: 'string' },
      },
      required: ['datasetId'],
    },
  },
  execute: async (input) => {
    const dataset = requireDataset(state, input)
    if (typeof dataset === 'string') return dataset
    const mode = readString(input.mode) === 'pair' ? 'pair' : 'matrix'
    const method = readString(input.method) === 'spearman' ? 'spearman' : 'pearson'
    const minPairs = readPositiveInt(input.minPairs, 5)
    const started = Date.now()
    
    const requestedColumns = readStringList(input.columns)
    const columnsToCorrelate = requestedColumns.length >= 2 ? requestedColumns : dataset.columns
    const jevError = runVizGate(state, {
      toolName: 'correlate',
      datasetColumns: columnsToCorrelate,
      datasetRowCount: dataset.rows.length,
      mode,
    })
    if (jevError) return jevError

    if (mode === 'pair') {
      const xColumn = readString(input.xColumn)
      const yColumn = readString(input.yColumn)
      if (!xColumn || !yColumn) {
        return JSON.stringify({ error: 'xColumn and yColumn required for mode=pair' })
      }
      const groupBy = readString(input.groupBy)
      const outputColumn = readString(input.outputColumn) ?? 'r'
      const groups = partitionRows(dataset.rows, groupBy)
      const rows = groups.map((group) => {
        const { r, n } = correlateColumns(group, xColumn, yColumn, method, minPairs)
        const out: Record<string, unknown> = {
          x_column: xColumn,
          y_column: yColumn,
          [outputColumn]: r,
          n,
          method,
        }
        if (groupBy) out[groupBy] = group[0]?.[groupBy] ?? null
        return out
      })
      const columns = uniqueColumns([
        ...(groupBy ? [groupBy] : []),
        'x_column',
        'y_column',
        outputColumn,
        'n',
        'method',
      ])
      return commitDataset(
        state,
        { id: 'tmp', columns, rows },
        {
          mode,
          method,
          durationSec: elapsedSec(started),
        },
        LEAN_TRANSFORM_RESULT
      )
    }

    const requested = readStringList(input.columns)
    const columns = requested.length >= 2 ? requested : inferNumericColumns(dataset)
    if (columns.length < 2) {
      return JSON.stringify({
        error: 'Need ≥2 numeric columns for correlation matrix',
        columns: dataset.columns,
      })
    }
    const finiteCounts = columns.map(
      (col) => dataset.rows.reduce((n, row) => (toNumber(row[col]) != null ? n + 1 : n), 0)
    )
    const rows: Array<Record<string, unknown>> = []
    for (let i = 0; i < columns.length; i++) {
      const left = columns[i]!
      rows.push({ x: left, y: left, r: 1, n: finiteCounts[i] })
      for (let j = i + 1; j < columns.length; j++) {
        const right = columns[j]!
        const { r, n } = correlateColumns(dataset.rows, left, right, method, minPairs)
        rows.push({ x: left, y: right, r, n })
        rows.push({ x: right, y: left, r, n })
      }
    }
    return commitDataset(
      state,
      {
        id: 'tmp',
        columns: ['x', 'y', 'r', 'n'],
        rows,
      },
      {
        mode: 'matrix',
        method,
        metrics: columns,
        durationSec: elapsedSec(started),
        note: 'add_chart chartType=heatmap (or omit — auto)',
      },
      LEAN_TRANSFORM_RESULT
    )
  },
})

const buildJoinDatasetsTool = (state: PremiumReportState): PremiumTool => ({
  schema: {
    name: 'join_datasets',
    description: 'Outer-join 2+ datasets on keys (default joueur). Use this for GPS × wellness discordance.',
    input_schema: {
      type: 'object',
      properties: {
        datasetIds: { type: 'array', items: { type: 'string' } },
        keys: { type: 'array', items: { type: 'string' } },
      },
      required: ['datasetIds'],
    },
  },
  execute: async (input) => {
    const ids = readStringList(input.datasetIds)
    if (ids.length < 2) return JSON.stringify({ error: 'datasetIds needs at least 2 ids' })
    const datasets = ids.map((id) => state.datasets.get(id))
    if (datasets.some((d) => !d)) {
      return JSON.stringify({
        error: 'unknown datasetId',
        missing: ids.filter((id) => !state.datasets.has(id)),
      })
    }
    const requestedKeys = readStringList(input.keys)
    const keys =
      requestedKeys.length > 0
        ? requestedKeys
        : [defaultGroupBy(datasets[0]!) ?? datasets[0]!.columns[0]!]
    const started = Date.now()
    const merged = joinOnKeys(datasets as PremiumDataset[], keys)
    return commitDataset(state, merged, {
      keys,
      durationSec: elapsedSec(started),
    })
  },
})

const buildFillDailyZerosTool = (state: PremiumReportState): PremiumTool => ({
  schema: {
    name: 'fill_daily_zeros',
    description: 'Densify daily series with 0 for valueColumns (rest days).',
    input_schema: {
      type: 'object',
      properties: {
        datasetId: { type: 'string' },
        dateColumn: { type: 'string' },
        groupBy: { type: 'string' },
        valueColumns: { type: 'array', items: { type: 'string' } },
        from: { type: 'string' },
        to: { type: 'string' },
      },
      required: ['datasetId'],
    },
  },
  execute: async (input) => {
    if (state.limits?.dropEmptyDaysDefault) {
      return JSON.stringify({
        error:
          'densify_daily blocked: coach asked to drop empty days — keep sparse calendar, do not fill rest days.',
        skipped: true,
        dropEmptyDaysDefault: true,
      })
    }
    const dataset = requireDataset(state, input)
    if (typeof dataset === 'string') return dataset
    const dateColumn = readString(input.dateColumn) ?? pickDateColumn(dataset.columns)
    if (!dateColumn) {
      return JSON.stringify({ error: 'dateColumn required', columns: dataset.columns })
    }
    const groupBy = defaultGroupBy(dataset, readString(input.groupBy))
    const { from, to } = readDateRange(input, state.dateRange)
    const valueColumnsRequested = readStringList(input.valueColumns)
    const valueColumns =
      valueColumnsRequested.length > 0
        ? valueColumnsRequested
        : inferNumericColumns(dataset, [dateColumn, ...(groupBy ? [groupBy] : [])])
    const densified = densifyDailyDataset({
      dataset,
      dateColumn,
      groupBy,
      valueColumns,
      from,
      to,
    })
    const cap = assertDatasetRowsCap(densified.rows.length)
    if (cap) return JSON.stringify({ error: cap })
    return commitDataset(state, densified, {
      filledMissing: null,
      dateColumn,
      groupBy: groupBy ?? null,
      valueColumns,
      from,
      to,
    })
  },
})

const buildTakeLatestTool = (state: PremiumReportState): PremiumTool => ({
  schema: {
    name: 'take_latest',
    description: 'Last row per groupBy by orderBy, or topN+sortColumn ranking.',
    input_schema: {
      type: 'object',
      properties: {
        datasetId: { type: 'string' },
        groupBy: { type: 'string' },
        orderBy: { type: 'string' },
        columns: { type: 'array', items: { type: 'string' } },
        topN: { type: 'number' },
        sortColumn: { type: 'string' },
      },
      required: ['datasetId'],
    },
  },
  execute: async (input) => {
    const dataset = requireDataset(state, input)
    if (typeof dataset === 'string') return dataset
    const topN = typeof input.topN === 'number' ? input.topN : Number(input.topN)
    const sortColumn = readString(input.sortColumn)
    const groupBy = defaultGroupBy(dataset, readString(input.groupBy))
    const orderBy = readString(input.orderBy) ?? pickDateColumn(dataset.columns)
    const keep = readStringList(input.columns)

    if (!groupBy || !orderBy) {
      if (Number.isFinite(topN) && topN > 0 && sortColumn) {
        return commitDataset(
          state,
          {
            ...dataset,
            rows: rankTopRows(dataset.rows, sortColumn, topN),
          },
          undefined,
          LEAN_TRANSFORM_RESULT
        )
      }
      return JSON.stringify({
        error: 'groupBy or orderBy could not be detected',
        hint: 'Use filter_dataset(top, sortBy) for rankings',
        columns: dataset.columns,
      })
    }

    let next = takeLatestRows(dataset, groupBy, orderBy, keep.length ? keep : undefined)
    if (Number.isFinite(topN) && topN > 0 && sortColumn) {
      next = { ...next, rows: rankTopRows(next.rows, sortColumn, topN) }
    }
    return commitDataset(state, next, undefined, LEAN_TRANSFORM_RESULT)
  },
})

const buildFilterDatasetTool = (state: PremiumReportState): PremiumTool => ({
  schema: {
    name: 'filter_dataset',
    description:
      'Filter/sort rows. Player focus: column=joueur op=eq|contains value="First Last". top+sortBy for rankings; column+op+value for filters.',
    input_schema: {
      type: 'object',
      properties: {
        datasetId: { type: 'string' },
        top: { type: 'number' },
        sortBy: { type: 'string' },
        sortDir: { type: 'string', enum: ['asc', 'desc'] },
        column: { type: 'string' },
        op: { type: 'string', enum: [...FILTER_OPS] },
        value: {},
      },
      required: ['datasetId'],
    },
  },
  execute: async (input) => {
    const dataset = requireDataset(state, input)
    if (typeof dataset === 'string') return dataset

    const top = typeof input.top === 'number' ? input.top : Number(input.top)
    const sortBy = readString(input.sortBy)
    if (Number.isFinite(top) && top > 0 && sortBy) {
      const sortError = requireDatasetColumns(dataset, [sortBy])
      if (sortError) return sortError
      const sortCol = resolveDatasetColumn(dataset, sortBy)!
      const dir = readString(input.sortDir) === 'asc' ? 'asc' : 'desc'
      return commitDataset(
        state,
        {
          ...dataset,
          rows: rankTopRows(dataset.rows, sortCol, top, dir),
        },
        undefined,
        LEAN_FILTER_RESULT
      )
    }

    const column = readString(input.column)
    const opRaw = readString(input.op)
    if (!column || !opRaw) {
      return JSON.stringify({
        error: 'Provide top+sortBy for top-N, or column+op(+value) for row filter.',
      })
    }
    const columnError = requireDatasetColumns(dataset, [column])
    if (columnError) return columnError
    const resolvedColumn = resolveDatasetColumn(dataset, column)!
    if (!isFilterOp(opRaw)) return JSON.stringify({ error: 'invalid op' })
    if (opRaw === 'not_null') {
      return commitDataset(state, filterRows(dataset, resolvedColumn, opRaw), undefined, LEAN_FILTER_RESULT)
    }

    const parsed = parseFilterCompare(input.value, opRaw)
    if (parsed == null) {
      return JSON.stringify({
        error: 'value required (number for gt/lt, or string for joueur eq/contains)',
      })
    }

    const value = parsed
    const asText = typeof value === 'string'

    if (asText && !value.trim()) {
      return JSON.stringify({ error: 'string value required for eq/ne/contains on text columns' })
    }

    const next = filterRows(dataset, resolvedColumn, opRaw, value)
    if (asText && next.rows.length === 0) {
      return JSON.stringify({
        error: `no rows for ${resolvedColumn} ${opRaw} "${value}"`,
        available_columns: dataset.columns,
        hint: 'Check joueur spelling (exact "First Last") or use op=contains',
      })
    }
    return commitDataset(
      state,
      next,
      { filtered: true, rows: next.rows.length },
      LEAN_FILTER_RESULT
    )
  },
})

const buildDropEmptyColumnsTool = (state: PremiumReportState): PremiumTool => ({
  schema: {
    name: 'drop_empty_columns',
    description: 'Drop metric columns that are all 0/empty.',
    input_schema: {
      type: 'object',
      properties: {
        datasetId: { type: 'string' },
      },
      required: ['datasetId'],
    },
  },
  execute: async (input) => {
    const dataset = requireDataset(state, input)
    if (typeof dataset === 'string') return dataset
    const { dataset: next, dropped } = pruneEmptyMetricColumns(dataset)
    if (next.columns.length === 0) {
      return JSON.stringify({ error: 'all columns would be dropped', dropped })
    }
    return commitDataset(state, next, {
      droppedEmptyColumns: dropped,
      note: dropped.length ? `Removed: ${dropped.join(', ')}` : 'No empty metrics',
    })
  },
})

const readFormulaParams = (input: Record<string, unknown>): ReportFormulaParams => {
  const params: ReportFormulaParams = {}
  for (const key of ['n', 'acute', 'chronic', 'minPoints', 'minSd'] as const) {
    const raw = input[key]
    if (typeof raw === 'number' && Number.isFinite(raw)) params[key] = raw
  }
  if (typeof input.uncoupled === 'boolean') params.uncoupled = input.uncoupled
  return params
}
