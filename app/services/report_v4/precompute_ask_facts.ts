import type { PremiumDataset } from '#contracts/premium_report'
import { pickAthleteColumn } from '#constants/premium_report_metrics'
import { pickDateColumn, toNumber } from '#services/premium_report/dataset_ops'
import { isRosterDataset } from '#services/report_v4/harvest_plan'
import { isImputedCell } from '#services/report_v4/imputed_cells'
import {
  computeFactValue,
  isValidFactId,
  upsertFact,
  type ReportFact,
  type ReportFactOp,
} from '#services/report_v4/report_facts'
import type { RosterAthlete } from '#services/report_v4/roster_macros'
import logger from '@adonisjs/core/services/logger'

export const ASK_FACT_ATHLETE_OPS = ['mean', 'max', 'last', 'delta'] as const
export type AskFactAthleteOp = (typeof ASK_FACT_ATHLETE_OPS)[number]

const slugPart = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 48)

export const athleteFactId = (athleteId: string, metric: string, op: AskFactAthleteOp): string =>
  `athlete.${slugPart(athleteId)}.${slugPart(metric)}.${op}`

export const teamFactId = (metric: string, op: ReportFactOp = 'mean'): string =>
  `team.${slugPart(metric)}.${op}`

export const expectedAskFactCount = (args: {
  athleteCount: number
  metricCount: number
  athleteOps?: number
}): number => {
  const ops = args.athleteOps ?? ASK_FACT_ATHLETE_OPS.length
  return args.athleteCount * args.metricCount * ops + args.metricCount
}

const foldName = (value: string): string =>
  value
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .trim()

const resolveAthleteKey = (args: {
  name: string
  roster: RosterAthlete[]
}): { id: string; name: string } => {
  const hit = args.roster.find((row) => foldName(row.name) === foldName(args.name))
  return {
    id: hit?.id?.trim() || slugPart(args.name) || 'athlete',
    name: hit?.name ?? args.name,
  }
}

const metricDatasets = (datasets: Iterable<PremiumDataset>): PremiumDataset[] =>
  [...datasets].filter(
    (dataset) =>
      !isRosterDataset(dataset) && dataset.rows.length > 0 && dataset.columns.length > 0
  )

const findMetricDataset = (
  datasets: PremiumDataset[],
  metric: string
): PremiumDataset | undefined =>
  datasets.find((dataset) => dataset.columns.includes(metric))

const athleteFilter = (athleteName: string, column: string) => ({
  column,
  op: 'eq' as const,
  value: athleteName,
})

const computeLastValue = (args: {
  dataset: PremiumDataset
  column: string
  athleteName: string
}): { ok: true; value: number } | { ok: false; error: string } => {
  const athleteCol = pickAthleteColumn(args.dataset.columns)
  if (!athleteCol) return { ok: false, error: 'no athlete column' }
  const needle = foldName(args.athleteName)
  const dateCol = pickDateColumn(args.dataset.columns)
  const indexed = args.dataset.rows
    .map((row, index) => ({ row, index }))
    .filter(({ row }) => foldName(String(row[athleteCol] ?? '')) === needle)
  if (indexed.length === 0) return { ok: false, error: 'no athlete rows' }
  const ordered = dateCol
    ? [...indexed].sort((left, right) =>
        String(left.row[dateCol] ?? '').localeCompare(String(right.row[dateCol] ?? ''))
      )
    : indexed
  for (let i = ordered.length - 1; i >= 0; i -= 1) {
    const entry = ordered[i]!
    if (isImputedCell(args.dataset, entry.index, args.column)) continue
    const n = toNumber(entry.row[args.column])
    if (n !== null && Number.isFinite(n)) return { ok: true, value: n }
  }
  return { ok: false, error: `no last value in ${args.column}` }
}

export const precomputeAskFacts = (args: {
  datasets: Iterable<PremiumDataset>
  registry: Map<string, ReportFact>
  athletes: Array<{ id?: string; name: string }>
  metrics: string[]
  roster?: RosterAthlete[]
}): { added: number; ids: string[] } => {
  const datasets = metricDatasets(args.datasets)
  const roster = args.roster ?? []
  const ids: string[] = []
  let added = 0

  const pushFact = (fact: ReportFact) => {
    if (!isValidFactId(fact.id) || args.registry.has(fact.id)) return
    upsertFact(args.registry, fact)
    ids.push(fact.id)
    added += 1
  }

  for (const metric of args.metrics) {
    const dataset = findMetricDataset(datasets, metric)
    if (!dataset) continue
    const teamMean = computeFactValue({ dataset, op: 'mean', column: metric })
    if (!teamMean.ok) continue
    const teamId = teamFactId(metric, 'mean')
    pushFact({
      id: teamId,
      value: teamMean.value,
      sourceDatasetId: dataset.id,
      column: metric,
      op: 'mean',
      label: `${metric} team mean`,
      ...(dataset.units?.[metric] ? { unit: dataset.units[metric] } : {}),
    })

    for (const athlete of args.athletes) {
      const key = resolveAthleteKey({ name: athlete.name, roster })
      const athleteCol = pickAthleteColumn(dataset.columns)
      if (!athleteCol) continue
      const filter = athleteFilter(key.name, athleteCol)

      const mean = computeFactValue({ dataset, op: 'mean', column: metric, filter })
      if (mean.ok) {
        pushFact({
          id: athleteFactId(key.id, metric, 'mean'),
          value: mean.value,
          sourceDatasetId: dataset.id,
          column: metric,
          op: 'mean',
          filter,
          label: `${key.name} ${metric} mean`,
          ...(dataset.units?.[metric] ? { unit: dataset.units[metric] } : {}),
        })
      }

      const max = computeFactValue({ dataset, op: 'max', column: metric, filter })
      if (max.ok) {
        pushFact({
          id: athleteFactId(key.id, metric, 'max'),
          value: max.value,
          sourceDatasetId: dataset.id,
          column: metric,
          op: 'max',
          filter,
          label: `${key.name} ${metric} max`,
          ...(dataset.units?.[metric] ? { unit: dataset.units[metric] } : {}),
        })
      }

      const last = computeLastValue({
        dataset,
        column: metric,
        athleteName: key.name,
      })
      if (last.ok) {
        pushFact({
          id: athleteFactId(key.id, metric, 'last'),
          value: last.value,
          sourceDatasetId: dataset.id,
          column: metric,
          op: 'last',
          filter,
          label: `${key.name} ${metric} last`,
          ...(dataset.units?.[metric] ? { unit: dataset.units[metric] } : {}),
        })
      }

      if (mean.ok) {
        pushFact({
          id: athleteFactId(key.id, metric, 'delta'),
          value: mean.value - teamMean.value,
          sourceDatasetId: dataset.id,
          column: metric,
          op: 'delta',
          filter,
          label: `${key.name} ${metric} vs team`,
          ...(dataset.units?.[metric] ? { unit: dataset.units[metric] } : {}),
        })
      }
    }
  }

  if (added > 0) {
    logger.info({ added, sample: ids.slice(0, 8) }, 'report_v4.precompute_ask_facts')
  }
  return { added, ids }
}
