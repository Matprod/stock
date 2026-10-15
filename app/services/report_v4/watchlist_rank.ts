import type { PremiumDataset } from '#contracts/premium_report'
import { pickAthleteColumn } from '#constants/premium_report_metrics'
import { toNumber } from '#services/premium_report/dataset_ops'
import { isRosterDataset } from '#services/report_v4/harvest_plan'
import type { ReportBrief } from '#services/report_v4/report_brief'

type NamedAthlete = {
  id?: string
  name: string
  position: string
}

const RISK_COLUMN_RE = /injury_risk_score|risk_score|acwr_ewma|acwr/i
const RETAINED_SIGNAL_RE =
  /acwr|ewma|srpe|monotony|strain|soreness|stress|fatigue|mood|energy.?rating|quality.?rating|wellbeing|injury_risk|performance_score|trimp|hmld|hsr/i
const NEVER_SIGNAL_RE = /carb|lipid|fat|zone[1-5]|energy_consumption/i

const foldName = (value: string): string =>
  value
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .trim()

const metricDatasets = (datasets: Iterable<PremiumDataset>): PremiumDataset[] =>
  [...datasets].filter(
    (dataset) =>
      !isRosterDataset(dataset) && dataset.rows.length > 0 && dataset.columns.length > 0
  )

const athleteMean = (
  dataset: PremiumDataset,
  athleteCol: string,
  metric: string,
  athleteName: string
): number | null => {
  const needle = foldName(athleteName)
  const values: number[] = []
  for (const row of dataset.rows) {
    if (foldName(String(row[athleteCol] ?? '')) !== needle) continue
    const n = toNumber(row[metric])
    if (n != null) values.push(n)
  }
  if (values.length === 0) return null
  return values.reduce((sum, n) => sum + n, 0) / values.length
}

const teamMean = (dataset: PremiumDataset, metric: string): number | null => {
  const values: number[] = []
  for (const row of dataset.rows) {
    const n = toNumber(row[metric])
    if (n != null) values.push(n)
  }
  if (values.length === 0) return null
  return values.reduce((sum, n) => sum + n, 0) / values.length
}

const signalColumns = (dataset: PremiumDataset): string[] =>
  dataset.columns.filter(
    (col) => RETAINED_SIGNAL_RE.test(col) && !NEVER_SIGNAL_RE.test(col)
  )

export type WatchlistScore = {
  name: string
  score: number
  hasData: boolean
}

export const scoreAthletesForWatchlist = (args: {
  athletes: NamedAthlete[]
  datasets: Iterable<PremiumDataset>
  presentNames?: Set<string>
}): WatchlistScore[] => {
  const datasets = metricDatasets(args.datasets)
  const present = args.presentNames
  return args.athletes.map((athlete) => {
    const hasData = present
      ? present.has(foldName(athlete.name))
      : datasets.some((dataset) => {
          const col = pickAthleteColumn(dataset.columns)
          if (!col) return false
          return dataset.rows.some((row) => foldName(String(row[col] ?? '')) === foldName(athlete.name))
        })
    if (!hasData) {
      return { name: athlete.name, score: 0, hasData: false }
    }
    let score = 0
    for (const dataset of datasets) {
      const athleteCol = pickAthleteColumn(dataset.columns)
      if (!athleteCol) continue
      for (const metric of signalColumns(dataset)) {
        const mean = athleteMean(dataset, athleteCol, metric, athlete.name)
        if (mean == null) continue
        if (RISK_COLUMN_RE.test(metric)) {
          score = Math.max(score, Math.abs(mean))
          continue
        }
        const team = teamMean(dataset, metric)
        if (team == null || team === 0) {
          score = Math.max(score, Math.abs(mean) * 0.01)
          continue
        }
        score = Math.max(score, Math.abs(mean - team) / Math.max(Math.abs(team), 1e-6))
      }
    }
    return { name: athlete.name, score, hasData: true }
  })
}

export const orderAthletesByWatchSignal = (args: {
  athletes: NamedAthlete[]
  datasets: Iterable<PremiumDataset>
  brief?: ReportBrief | null
  presentNames?: Set<string>
}): { ordered: NamedAthlete[]; missingData: string[] } => {
  const byFold = new Map(args.athletes.map((row) => [foldName(row.name), row] as const))
  const scores = scoreAthletesForWatchlist({
    athletes: args.athletes,
    datasets: args.datasets,
    presentNames: args.presentNames,
  })
  const scoreByName = new Map(scores.map((row) => [foldName(row.name), row] as const))
  const missingData = scores.filter((row) => !row.hasData).map((row) => row.name)

  const briefBoost = new Map<string, number>()
  if (args.brief) {
    for (const signal of args.brief.signals) {
      if (!signal.athlete) continue
      const key = foldName(signal.athlete)
      const levelBoost = signal.level === 'watch' ? 3 : signal.level === 'review' ? 2 : 1
      briefBoost.set(key, Math.max(briefBoost.get(key) ?? 0, levelBoost))
      const scored = scoreByName.get(key)
      if (scored && !scored.hasData) {
        briefBoost.delete(key)
      }
    }
  }

  const withData = args.athletes.filter((row) => scoreByName.get(foldName(row.name))?.hasData)
  const withoutData = args.athletes.filter((row) => !scoreByName.get(foldName(row.name))?.hasData)

  withData.sort((left, right) => {
    const lKey = foldName(left.name)
    const rKey = foldName(right.name)
    const lScore =
      (scoreByName.get(lKey)?.score ?? 0) + (briefBoost.get(lKey) ?? 0) * 0.25
    const rScore =
      (scoreByName.get(rKey)?.score ?? 0) + (briefBoost.get(rKey) ?? 0) * 0.25
    if (rScore !== lScore) return rScore - lScore
    return left.name.localeCompare(right.name, 'en', { sensitivity: 'base' })
  })

  const ordered = [
    ...withData,
    ...withoutData.sort((left, right) =>
      left.name.localeCompare(right.name, 'en', { sensitivity: 'base' })
    ),
  ]
    .map((row) => byFold.get(foldName(row.name)))
    .filter((row): row is NamedAthlete => Boolean(row))

  return { ordered, missingData }
}
