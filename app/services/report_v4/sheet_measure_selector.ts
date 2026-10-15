import { PREMIUM_DOMAIN, type PremiumDomain } from '#constants/premium_report_domains'
import type { PremiumDataset } from '#contracts/premium_report'
import { isNumericColumn } from '#services/premium_report/charts/dataset_transforms'

export type SheetMeasureFamily = 'primary_load' | 'intensity' | 'hrv' | 'ask' | 'domain'

export type SheetMeasurePick = {
  datasetId: string
  metric: string
  family: SheetMeasureFamily
}

export type SheetMeasureSelection = {
  picks: SheetMeasurePick[]
  metrics: string[]
  choiceRule: string
}

const NOISE_COLUMN_RE =
  /^(energy_consumption_(carbs|fats)|zone[1-5]_time|zone[1-5]|carbs?|lipids?|fats?)$/i

const GPS_PRIMARY_LOAD_ALIASES = [
  'movement_load',
  'player_load',
  'total_player_load',
  'total_distance',
  'total_distance_m',
  'distance_m',
  'kpi_distancetotal',
  'kpi_distance_total',
  'distance',
]

const GPS_INTENSITY_ALIASES = [
  'trimp',
  'hmld',
  'hmld_m',
  'hsr',
  'hsr_z5_m',
  'sprint_distance',
  'epoc_final',
  'dsl',
  'high_speed_running',
]

const GPS_HRV_ALIASES = ['rmssd']

const LOAD_ALIASES = ['srpe_daily', 'srpe', 'acwr_ewma', 'ewma_7', 'ewma_28', 'monotony', 'strain']

const WELLNESS_ALIASES = [
  'mood_rating',
  'stress_rating',
  'energy_rating',
  'body_soreness_rating',
  'wellbeing_rating',
]

const SLEEP_ALIASES = ['quality_rating', 'sleep_duration', 'efficiency', 'sleep_efficiency']

const SCORES_ALIASES = ['performance_score', 'injury_risk_score']

const foldCol = (value: string): string => value.trim().toLowerCase()

const columnIndex = (dataset: PremiumDataset): Map<string, string> => {
  const map = new Map<string, string>()
  for (const col of dataset.columns) map.set(foldCol(col), col)
  return map
}

const findAlias = (dataset: PremiumDataset, aliases: string[]): string | null => {
  const index = columnIndex(dataset)
  for (const alias of aliases) {
    const hit = index.get(foldCol(alias))
    if (!hit) continue
    if (!isNumericColumn(dataset, hit)) continue
    if (NOISE_COLUMN_RE.test(hit)) continue
    return hit
  }
  return null
}

const isNoiseUnlessAsked = (metric: string, askFolded: Set<string>): boolean =>
  NOISE_COLUMN_RE.test(metric) && !askFolded.has(foldCol(metric))

const domainAliasGroups = (
  domain: PremiumDomain
): Array<{ family: SheetMeasureFamily; aliases: string[] }> => {
  if (domain === PREMIUM_DOMAIN.GPS) {
    return [
      { family: 'primary_load', aliases: GPS_PRIMARY_LOAD_ALIASES },
      { family: 'intensity', aliases: GPS_INTENSITY_ALIASES },
      { family: 'hrv', aliases: GPS_HRV_ALIASES },
    ]
  }
  if (domain === PREMIUM_DOMAIN.LOAD) {
    return [{ family: 'domain', aliases: LOAD_ALIASES }]
  }
  if (domain === PREMIUM_DOMAIN.WELLNESS) {
    return [{ family: 'domain', aliases: WELLNESS_ALIASES }]
  }
  if (domain === PREMIUM_DOMAIN.SLEEP) {
    return [{ family: 'domain', aliases: SLEEP_ALIASES }]
  }
  if (domain === PREMIUM_DOMAIN.SCORES) {
    return [{ family: 'domain', aliases: SCORES_ALIASES }]
  }
  return []
}

const FAMILY_LABEL: Record<SheetMeasureFamily, string> = {
  primary_load: 'primary load',
  intensity: 'intensity',
  hrv: 'HRV',
  ask: 'ask metric',
  domain: 'domain priority',
}

export const selectSheetMeasures = (args: {
  datasets: PremiumDataset[]
  domains: PremiumDomain[]
  askMetrics?: string[]
  maxMeasures?: number
}): SheetMeasureSelection => {
  const maxMeasures = args.maxMeasures ?? 4
  const askMetrics = args.askMetrics ?? []
  const askFolded = new Set(askMetrics.map(foldCol))
  const picks: SheetMeasurePick[] = []
  const seen = new Set<string>()

  const push = (datasetId: string, metric: string, family: SheetMeasureFamily) => {
    if (picks.length >= maxMeasures) return
    const key = `${datasetId}::${metric}`
    if (seen.has(key) || seen.has(metric)) return
    if (isNoiseUnlessAsked(metric, askFolded)) return
    seen.add(key)
    seen.add(metric)
    picks.push({ datasetId, metric, family })
  }

  for (const metric of askMetrics) {
    for (const dataset of args.datasets) {
      if (!dataset.columns.includes(metric)) continue
      if (!isNumericColumn(dataset, metric)) continue
      push(dataset.id, metric, 'ask')
      break
    }
  }

  if (picks.length === 0) {
    const domains = args.domains.length > 0 ? args.domains : [PREMIUM_DOMAIN.GPS]
    for (const domain of domains) {
      const groups = domainAliasGroups(domain)
      if (groups.length === 0) continue
      for (const group of groups) {
        for (const dataset of args.datasets) {
          const hit = findAlias(dataset, group.aliases)
          if (!hit) continue
          push(dataset.id, hit, group.family)
          break
        }
      }
    }
  }

  if (picks.length === 0) {
    for (const dataset of args.datasets) {
      for (const col of dataset.columns) {
        if (!isNumericColumn(dataset, col)) continue
        if (isNoiseUnlessAsked(col, askFolded)) continue
        if (/^(joueur|athlete|player|date|date_of_day|poste|n)$/i.test(col)) continue
        push(dataset.id, col, 'domain')
        if (picks.length >= maxMeasures) break
      }
      if (picks.length >= maxMeasures) break
    }
  }

  const choiceRule =
    picks.length === 0
      ? 'Measure choice: none — no populated numeric columns in club datasets.'
      : `Measure choice: ${picks
          .map((row) => `${row.metric} (${FAMILY_LABEL[row.family]})`)
          .join(', ')} — first matching vendor aliases present in club datasets.`

  return {
    picks,
    metrics: picks.map((row) => row.metric),
    choiceRule,
  }
}
