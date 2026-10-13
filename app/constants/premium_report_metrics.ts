export type PremiumAggKpi = {
  name: string
  alias: string
  agg: 'SUM' | 'MAX' | 'AVG'
  digits: number
}

export type GpsIntensityKpi = PremiumAggKpi

export const LOAD_SUMMARY_METRIC_COLUMNS = [
  'srpe_daily',
  'ewma_7',
  'ewma_28',
  'monotony',
  'strain',
  'acwr_ewma',
  'cumulative_7',
] as const

export const PREMIUM_SERIES_VALUE_COLUMNS = [
  ...LOAD_SUMMARY_METRIC_COLUMNS,
  'player_load',
  'total_distance_m',
  'distance_m',
] as const

export const PREMIUM_ATHLETE_COLUMNS = [
  'joueur',
  'Joueur',
  'Player',
  'player',
  'name',
  'athlete',
  'Athlete',
  'Athlète',
  'full_name',
  'athlete_name',
] as const

export const pickGpsOrderColumn = (aliases: string[]): string => aliases[0] ?? 'joueur'

export const pickPreferredSeriesColumn = (
  columns: string[],
  preferred: readonly string[] = PREMIUM_SERIES_VALUE_COLUMNS
): string | undefined => {
  const available = new Set(columns.map((column) => column.toLowerCase()))
  for (const name of preferred) {
    if (available.has(name.toLowerCase())) {
      return columns.find((column) => column.toLowerCase() === name.toLowerCase())
    }
  }
  return undefined
}

export const pickAthleteColumn = (columns: string[]): string | undefined => {
  for (const name of PREMIUM_ATHLETE_COLUMNS) {
    if (columns.includes(name)) return name
  }
  return undefined
}
