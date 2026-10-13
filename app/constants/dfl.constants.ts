import type { DflPlayerMatchMetrics } from '#contracts/dfl'

export const DFL_API_CONFIG = {
  baseUrl: 'https://httpget.distribution.production.datahub-sts.de',
  timeoutMs: 120_000,
  maxRetries: 3,
  interCallDelayMs: 150,
} as const

export const MATCH_PROVIDERS_SYNC_LOOKBACK_DAYS = 14

export const DFL_IMPORT_MIN_DATE = '2022-06-20'

export const DFL_SERVICES = {
  seasons: 'DFL-01.07-Stammdaten-Saison',
  clubs: 'DFL-01.04-Stammdaten-Vereine',
  schedule: 'DFL-01.06-Stammdaten-Spielplan',
  matchInfo: 'DFL-02.01-Spielinformationen',
  eventStats: 'DFL-03.03-Ereignisdaten-Spiel-Statistik',
  distance: 'DFL-04.04-Gesamtlaufdistanz-Spiel',
  positionalStats: 'DFL-04.07-Positionsdaten-Spiel-Statistik',
} as const

/** Bundesliga + 2. Bundesliga */
export const DFL_COMPETITION_IDS = ['DFL-COM-000001', 'DFL-COM-000002'] as const

export const DFL_METRIC_NAMES = [
  'minutes_played',
  'total_distance',
  'sprint_distance',
  'intensive_run_distance',
  'max_speed',
  'tackles_contested',
  'tackles_won',
] as const

export const mapDflPlayerMetrics = (
  row: DflPlayerMatchMetrics
): Record<(typeof DFL_METRIC_NAMES)[number], number | null> => ({
  minutes_played: row.minutesPlayed,
  total_distance: row.totalDistance,
  sprint_distance: row.sprintDistance,
  intensive_run_distance: row.intensiveRunDistance,
  max_speed: row.maxSpeed,
  tackles_contested: row.tacklesContested,
  tackles_won: row.tacklesWon,
})
