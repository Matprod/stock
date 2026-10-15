import type { PremiumDataset } from '#contracts/premium_report'
import { listDatasetAthletes } from '#services/premium_report/charts/dataset_transforms'
import { isRosterDataset } from '#services/report_v4/harvest_plan'

export type PresentPlayersMap = Record<string, string[]>

const foldName = (value: string): string =>
  value
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .trim()

export const mapPresentPlayersByDataset = (
  datasets: Iterable<PremiumDataset>
): PresentPlayersMap => {
  const out: PresentPlayersMap = {}
  for (const dataset of datasets) {
    if (!dataset?.id || isRosterDataset(dataset) || dataset.rows.length === 0) continue
    const names = listDatasetAthletes(dataset)
    if (names.length === 0) continue
    out[dataset.id] = names
  }
  return out
}

export const collectPresentPlayerNames = (map: PresentPlayersMap): Set<string> => {
  const names = new Set<string>()
  for (const list of Object.values(map)) {
    for (const name of list) names.add(foldName(name))
  }
  return names
}

export const athletePresentInAnyDataset = (
  athleteName: string,
  present: Set<string>
): boolean => present.has(foldName(athleteName))

export const athletePresentInDatasets = (
  athleteName: string,
  datasets: Iterable<PremiumDataset>
): boolean => {
  const needle = foldName(athleteName)
  for (const dataset of datasets) {
    if (isRosterDataset(dataset) || dataset.rows.length === 0) continue
    for (const name of listDatasetAthletes(dataset)) {
      if (foldName(name) === needle) return true
    }
  }
  return false
}
