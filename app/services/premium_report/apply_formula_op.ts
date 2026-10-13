import type { ReportFormulaId } from '#constants/report_builder.constants'
import type { PremiumDataset } from '#contracts/premium_report'
import {
  REPORT_FORMULAS,
  applyFormula,
  mergeFormulaParams,
  type ReportFormulaParams,
} from '#services/report_v4/metrics/formulas'
import {
  densifyDailyDataset,
  looksLikeDateColumn,
  partitionRows,
  toNumber,
  compareValues,
} from '#services/premium_report/dataset_ops'

export const FORMULAS_FILL_REST_DAYS = new Set<ReportFormulaId>([
  'monotony',
  'strain',
  'ewma',
  'ma',
  'median_ma',
  'cumulative',
  'acwr_ma',
  'acwr_ewma',
])

export const applyFormulaOnDataset = (args: {
  dataset: PremiumDataset
  valueColumn: string
  groupBy?: string
  orderBy?: string
  outputColumn: string
  formulaId: ReportFormulaId
  params?: ReportFormulaParams
  fillRestDays?: boolean
  dateRange: { from: string; to: string }
}): PremiumDataset => {
  const def = REPORT_FORMULAS[args.formulaId]
  const params = mergeFormulaParams(args.formulaId, args.params)
  const fillRestDays =
    args.fillRestDays ?? FORMULAS_FILL_REST_DAYS.has(args.formulaId)

  let working: PremiumDataset =
    def.kind === 'reduce'
      ? args.dataset
      : {
          id: 'tmp',
          columns: [...args.dataset.columns],
          rows: args.dataset.rows.map((row) => ({ ...row })),
          ...(args.dataset.units ? { units: args.dataset.units } : {}),
          ...(args.dataset.labels ? { labels: args.dataset.labels } : {}),
          ...(args.dataset.dateRange ? { dateRange: args.dataset.dateRange } : {}),
        }
  if (
    def.kind !== 'reduce' &&
    fillRestDays &&
    args.orderBy &&
    looksLikeDateColumn(args.orderBy, working)
  ) {
    working = densifyDailyDataset({
      dataset: working,
      dateColumn: args.orderBy,
      groupBy: args.groupBy,
      valueColumns: [args.valueColumn],
      from: args.dateRange.from,
      to: args.dateRange.to,
    })
  }

  if (def.kind === 'reduce') {
    const groups = partitionRows(working.rows, args.groupBy)
    const outRows: Array<Record<string, unknown>> = []
    for (const group of groups) {
      const ordered = args.orderBy
        ? [...group].sort((a, b) => compareValues(a[args.orderBy!], b[args.orderBy!]))
        : group
      const series = ordered.map((row) => toNumber(row[args.valueColumn]))
      const result = applyFormula(series, { id: args.formulaId, params })
      const base: Record<string, unknown> = {}
      if (args.groupBy) base[args.groupBy] = ordered[0]?.[args.groupBy] ?? null
      base[args.outputColumn] = result.scalar ?? null
      outRows.push(base)
    }
    return {
      id: 'tmp',
      columns: [...(args.groupBy ? [args.groupBy] : []), args.outputColumn],
      rows: outRows,
      ...(working.units ? { units: working.units } : {}),
      ...(working.labels ? { labels: working.labels } : {}),
    }
  }

  applyFormulaColumnInPlace({
    dataset: working,
    valueColumn: args.valueColumn,
    groupBy: args.groupBy,
    orderBy: args.orderBy,
    outputColumn: args.outputColumn,
    formulaId: args.formulaId,
    params,
  })

  return working
}

/** Mutate row objects in `dataset` — add `outputColumn` without cloning the frame. */
export const applyFormulaColumnInPlace = (args: {
  dataset: PremiumDataset
  valueColumn: string
  groupBy?: string
  orderBy?: string
  outputColumn: string
  formulaId: ReportFormulaId
  params?: ReportFormulaParams
}): void => {
  const params = mergeFormulaParams(args.formulaId, args.params)
  const groups = partitionRows(args.dataset.rows, args.groupBy)
  for (const group of groups) {
    const ordered = args.orderBy
      ? [...group].sort((a, b) => compareValues(a[args.orderBy!], b[args.orderBy!]))
      : group
    const series = ordered.map((row) => toNumber(row[args.valueColumn]))
    const result = applyFormula(series, { id: args.formulaId, params })
    for (let i = 0; i < ordered.length; i++) {
      ordered[i]![args.outputColumn] = result.series[i] ?? null
    }
  }
  if (!args.dataset.columns.includes(args.outputColumn)) {
    args.dataset.columns.push(args.outputColumn)
  }
}
