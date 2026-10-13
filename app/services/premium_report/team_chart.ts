import { pickAthleteColumn } from '#constants/premium_report_metrics'
import type { PremiumDataset } from '#contracts/premium_report'
import {
  aggregateDataset,
  pickDateColumn,
  toNumber,
  type AggregateOp,
} from '#services/premium_report/dataset_ops'
import type { AppLanguage } from '#utils/localize'

export type TeamChartOp = Extract<AggregateOp, 'mean' | 'sum'>

export const teamSeriesLabel = (language: AppLanguage, op: TeamChartOp): string => {
  if (language === 'fr') {
    if (op === 'sum') return 'Équipe (Σ)'
    return 'Équipe (moy.)'
  }
  if (op === 'sum') return 'Team (Σ)'
  return 'Team (mean)'
}

const reduceValues = (values: number[], op: TeamChartOp): number => {
  const reduced =
    op === 'sum' ? values.reduce((acc, n) => acc + n, 0) : values.reduce((acc, n) => acc + n, 0) / values.length
  return Math.round(reduced * 1000) / 1000
}

const numericColumns = (
  dataset: PremiumDataset,
  dateColumn: string,
  skip: Set<string>
): string[] =>
  dataset.columns.filter(
    (col) =>
      col !== dateColumn &&
      col !== 'n' &&
      !skip.has(col) &&
      dataset.rows.some((row) => toNumber(row[col]) != null)
  )

const collapseWideByDate = (
  dataset: PremiumDataset,
  dateColumn: string,
  op: TeamChartOp,
  seriesLabel: string
): PremiumDataset => {
  const valueColumns = numericColumns(dataset, dateColumn, new Set([seriesLabel]))
  const rows = dataset.rows.flatMap((row) => {
    const date = row[dateColumn]
    if (date == null || String(date).trim() === '') return []
    const values = valueColumns.map((col) => toNumber(row[col])).filter((n): n is number => n != null)
    if (!values.length) return []
    return [{ [dateColumn]: date, [seriesLabel]: reduceValues(values, op) }]
  })
  return {
    ...dataset,
    id: 'tmp',
    columns: [dateColumn, seriesLabel],
    rows,
  }
}

const dailyTeamMeanByDate = (
  squad: PremiumDataset,
  metricColumn: string,
  op: TeamChartOp
): Map<string, number> | { error: string } => {
  const dateColumn = pickDateColumn(squad.columns)
  if (!dateColumn) return { error: 'Squad dataset has no date column' }
  if (!squad.columns.includes(metricColumn)) {
    return { error: `Squad dataset missing metric ${metricColumn}` }
  }
  const athleteColumn = pickAthleteColumn(squad.columns)
  const groups = new Map<string, number[]>()
  for (const row of squad.rows) {
    const date = String(row[dateColumn] ?? '').trim()
    if (!date) continue
    if (athleteColumn) {
      const athlete = String(row[athleteColumn] ?? '').trim()
      if (!athlete) continue
    }
    const n = toNumber(row[metricColumn])
    if (n == null) continue
    const bucket = groups.get(date) ?? []
    bucket.push(n)
    groups.set(date, bucket)
  }
  if (groups.size === 0) return { error: 'No squad daily values for team mean' }
  const out = new Map<string, number>()
  for (const [date, values] of groups) {
    if (values.length === 0) continue
    out.set(date, reduceValues(values, op))
  }
  return out.size > 0 ? out : { error: 'No squad daily values for team mean' }
}

export const pickSquadMetricColumn = (
  squad: PremiumDataset,
  chartTitle: string,
  chartColumns: string[]
): string | undefined => {
  const intent = /injury|blessure|risque/i.test(chartTitle)
    ? 'injury'
    : /perf|performance/i.test(chartTitle)
      ? 'perf'
      : 'none'
  const candidates = squad.columns.filter(
    (col) =>
      col !== pickDateColumn(squad.columns) &&
      col !== pickAthleteColumn(squad.columns) &&
      col !== 'n' &&
      squad.rows.some((row) => toNumber(row[col]) != null)
  )
  if (intent === 'injury') {
    const hit = candidates.find((col) => /injury[_\s-]?risk/i.test(col))
    if (hit) return hit
  }
  if (intent === 'perf') {
    const hit = candidates.find((col) => /performance[_\s-]?score/i.test(col))
    if (hit) return hit
  }
  for (const col of chartColumns) {
    const hit = candidates.find((c) => c.toLowerCase() === col.toLowerCase())
    if (hit) return hit
  }
  return candidates.find((col) => /performance[_\s-]?score|injury[_\s-]?risk/i.test(col))
}

export const overlayTeamMeanFromSquad = (args: {
  chartDataset: PremiumDataset
  squadDataset: PremiumDataset
  metricColumn: string
  op?: TeamChartOp
  seriesLabel?: string
  language?: AppLanguage
}): { dataset: PremiumDataset; mode: 'overlay' } | { error: string } => {
  const op = args.op ?? 'mean'
  const language = args.language ?? 'fr'
  const seriesLabel = args.seriesLabel?.trim() || teamSeriesLabel(language, op)
  const dateColumn = pickDateColumn(args.chartDataset.columns)
  if (!dateColumn) return { error: 'No date column — team mean only applies to evolution charts' }

  const means = dailyTeamMeanByDate(args.squadDataset, args.metricColumn, op)
  if ('error' in means) return means

  const athleteColumn = pickAthleteColumn(args.chartDataset.columns)
  if (athleteColumn) {
    const kept = args.chartDataset.rows.filter(
      (row) => String(row[athleteColumn] ?? '').trim() !== seriesLabel
    )
    const valueColumns = args.chartDataset.columns.filter(
      (col) => col !== dateColumn && col !== athleteColumn && col !== 'n'
    )
    const metric =
      valueColumns.find((col) => col === args.metricColumn) ??
      valueColumns.find((col) => /performance[_\s-]?score|injury[_\s-]?risk/i.test(col)) ??
      valueColumns[0]
    if (!metric) return { error: 'Chart has no metric column to attach team mean' }
    const extra = [...means.entries()].map(([date, value]) => ({
      [dateColumn]: date,
      [athleteColumn]: seriesLabel,
      [metric]: value,
    }))
    return {
      dataset: {
        ...args.chartDataset,
        columns: args.chartDataset.columns.filter((col) => col !== 'n'),
        rows: [...kept, ...extra],
      },
      mode: 'overlay',
    }
  }

  const rows = args.chartDataset.rows.map((row) => {
    const date = String(row[dateColumn] ?? '').trim()
    const mean = means.get(date)
    if (mean == null) return row
    return { ...row, [seriesLabel]: mean }
  })
  const missingDates = [...means.entries()].filter(
    ([date]) => !args.chartDataset.rows.some((row) => String(row[dateColumn] ?? '').trim() === date)
  )
  const extras = missingDates.map(([date, value]) => ({
    [dateColumn]: date,
    [seriesLabel]: value,
  }))
  return {
    dataset: {
      ...args.chartDataset,
      columns: [
        ...args.chartDataset.columns.filter((col) => col !== 'n' && col !== seriesLabel),
        seriesLabel,
      ],
      rows: [...rows, ...extras],
    },
    mode: 'overlay',
  }
}

export const overlayTeamSeries = (args: {
  dataset: PremiumDataset
  op?: TeamChartOp
  seriesLabel?: string
  language?: AppLanguage
  squadDataset?: PremiumDataset
  chartTitle?: string
}): { dataset: PremiumDataset; mode: 'overlay' } | { error: string } => {
  const op = args.op ?? 'mean'
  const language = args.language ?? 'fr'
  const seriesLabel = args.seriesLabel?.trim() || teamSeriesLabel(language, op)
  const dateColumn = pickDateColumn(args.dataset.columns)
  if (!dateColumn) return { error: 'No date column — team mean only applies to evolution charts' }

  const athleteColumn = pickAthleteColumn(args.dataset.columns)
  const athleteCount = athleteColumn
    ? new Set(args.dataset.rows.map((row) => String(row[athleteColumn] ?? '').trim()).filter(Boolean))
        .size
    : 0

  if (athleteColumn && athleteCount > 1) {
    const valueColumns = args.dataset.columns.filter(
      (col) => col !== dateColumn && col !== athleteColumn && col !== 'n'
    )
    if (!valueColumns.length) return { error: 'No numeric metric columns to average' }
    const groups = new Map<string, Array<Record<string, unknown>>>()
    for (const row of args.dataset.rows) {
      const date = String(row[dateColumn] ?? '').trim()
      if (!date || String(row[athleteColumn] ?? '').trim() === seriesLabel) continue
      const bucket = groups.get(date) ?? []
      bucket.push(row)
      groups.set(date, bucket)
    }
    const extra = [...groups.entries()].flatMap(([date, rows]) => {
      const out: Record<string, unknown> = { [dateColumn]: date, [athleteColumn]: seriesLabel }
      let any = false
      for (const col of valueColumns) {
        const values = rows.map((row) => toNumber(row[col])).filter((n): n is number => n != null)
        if (!values.length) continue
        out[col] = reduceValues(values, op)
        any = true
      }
      return any ? [out] : []
    })
    if (!extra.length) return { error: 'No daily values to average' }
    const kept = args.dataset.rows.filter(
      (row) => String(row[athleteColumn] ?? '').trim() !== seriesLabel
    )
    return {
      dataset: {
        ...args.dataset,
        columns: args.dataset.columns.filter((col) => col !== 'n'),
        rows: [...kept, ...extra],
      },
      mode: 'overlay',
    }
  }

  const valueColumns = numericColumns(args.dataset, dateColumn, new Set([seriesLabel]))
  if (valueColumns.length >= 2) {
    const rows = args.dataset.rows.map((row) => {
      const values = valueColumns
        .map((col) => toNumber(row[col]))
        .filter((n): n is number => n != null)
      if (!values.length) return row
      return { ...row, [seriesLabel]: reduceValues(values, op) }
    })
    return {
      dataset: {
        ...args.dataset,
        columns: [
          ...args.dataset.columns.filter((col) => col !== 'n' && col !== seriesLabel),
          seriesLabel,
        ],
        rows,
      },
      mode: 'overlay',
    }
  }

  if (args.squadDataset) {
    const metric = pickSquadMetricColumn(
      args.squadDataset,
      args.chartTitle ?? '',
      args.dataset.columns
    )
    if (!metric) {
      return { error: 'Need squad metric column (performance_score / injury_risk_score) for team mean' }
    }
    return overlayTeamMeanFromSquad({
      chartDataset: args.dataset,
      squadDataset: args.squadDataset,
      metricColumn: metric,
      op,
      seriesLabel,
      language,
    })
  }

  return {
    error:
      'Need at least two player series to add a team line — fetch squad scores then retry charts_to_team',
  }
}

export const datasetToTeamGrain = (args: {
  dataset: PremiumDataset
  op?: TeamChartOp
  seriesLabel?: string
  language?: AppLanguage
}): { dataset: PremiumDataset; mode: 'long' | 'wide' | 'already_team' } | { error: string } => {
  const op = args.op ?? 'mean'
  const language = args.language ?? 'fr'
  const seriesLabel = args.seriesLabel?.trim() || teamSeriesLabel(language, op)
  const dateColumn = pickDateColumn(args.dataset.columns)
  if (!dateColumn) {
    return { error: 'No date column — team grain only applies to evolution charts' }
  }

  const athleteColumn = pickAthleteColumn(args.dataset.columns)
  const athleteCount = athleteColumn
    ? new Set(
        args.dataset.rows.map((row) => String(row[athleteColumn] ?? '').trim()).filter(Boolean)
      ).size
    : 0

  if (athleteColumn && athleteCount > 1) {
    const valueColumns = args.dataset.columns.filter(
      (col) => col !== dateColumn && col !== athleteColumn && col !== 'n'
    )
    if (!valueColumns.length) {
      return { error: 'No numeric metric columns to aggregate' }
    }
    const aggregated = aggregateDataset({
      dataset: args.dataset,
      groupBy: dateColumn,
      columns: valueColumns.slice(0, 8),
      ops: [op],
    })
    const metricCols = aggregated.columns.filter((col) => col !== dateColumn && col !== 'n')
    aggregated.rows = aggregated.rows.map((row) => {
      const next = { ...row }
      delete next.n
      if (metricCols.length === 1 && metricCols[0] !== seriesLabel) {
        const from = metricCols[0]!
        next[seriesLabel] = row[from]
        delete next[from]
      }
      return next
    })
    aggregated.columns =
      metricCols.length === 1
        ? [dateColumn, seriesLabel]
        : [dateColumn, ...metricCols.filter((col) => col !== seriesLabel)]
    return { dataset: aggregated, mode: 'long' }
  }

  const numericOthers = args.dataset.columns.filter(
    (col) =>
      col !== dateColumn &&
      col !== 'n' &&
      args.dataset.rows.some((row) => toNumber(row[col]) != null)
  )
  if (numericOthers.length >= 2) {
    return {
      dataset: collapseWideByDate(args.dataset, dateColumn, op, seriesLabel),
      mode: 'wide',
    }
  }

  if (numericOthers.length === 1) {
    return { dataset: args.dataset, mode: 'already_team' }
  }

  return { error: 'Chart is not a multi-athlete evolution (nothing to collapse)' }
}
