export const BASKETBALL_METRICS = [
  'basketball_field_time',
  'basketball_ftm',
  'basketball_fta',
  'basketball_2pm',
  'basketball_2pa',
  'basketball_3pm',
  'basketball_3pa',
  'basketball_assists',
  'basketball_rebounds',
  'basketball_points',
  'basketball_minutes',
  'basketball_jumps',
  'basketball_player_load',
  'basketball_high_intensity_pl',
  'basketball_hsr',
  'basketball_training_load',
  'basketball_match_result',
] as const

export const POSITION_FORWARD = ['Small Forward (SF)', 'Power Forward (PF)'] as const
export const POSITION_CENTER = ['Center (C)'] as const
export const POSITION_GUARD = ['Point Guard (PG)', 'Shooting Guard (SG)'] as const

export const POSITIONS = {
  forward: POSITION_FORWARD,
  center: POSITION_CENTER,
  guard: POSITION_GUARD,
} as const

export const TRAINING_LOAD_CONFIGS = {
  forward: {
    metric1: 'basketball_player_load',
    metric2: 'basketball_jumps',
    coeff1: 0.5,
    coeff2: 0.5,
  },
  center: {
    metric1: 'basketball_jumps',
    metric2: 'basketball_high_intensity_pl',
    coeff1: 0.65,
    coeff2: 0.35,
  },
  guard: {
    metric1: 'basketball_player_load',
    metric2: 'basketball_hsr',
    coeff1: 0.5,
    coeff2: 0.5,
  },
} as const

export const TYPICAL_METRIC_MAXES: Record<string, number> = {
  basketball_jumps: 30,
  basketball_player_load: 20,
  basketball_high_intensity_pl: 15,
  basketball_hsr: 10,
}

export const LNB_LEAGUE_ID = 2
export const EUROCUP_LEAGUE_ID = 194
export const LEADERS_CUP_LEAGUE_ID = 11

export const DEFAULT_LNB_SEASON = '2025-2026'
export const DEFAULT_EUROCUP_SEASON = '2025'
export const DEFAULT_LEADERS_CUP_SEASON = '2026'

export const DEFAULT_DELAY_MS = 500

export const BASKETBALL_SYNC_DAYS = 7
export const JL_BOURG_TEAM_ID = 24

export const DEFAULT_BASKETBALL_CLUB_ID = 7

export const FINISHED_GAME_STATUSES = ['FT', 'AOT'] as const

export const DEFAULT_BASKETBALL_EVENT_TYPE_NAME_FR = 'Match de Basketball'
export const DEFAULT_BASKETBALL_EVENT_TYPE_NAME_EN = 'Basketball Match'

export const TEAM_STAT_COLUMNS = [
  { apiKey: 'field_goals', props: ['total', 'attempts'] as const },
  { apiKey: 'threepoint_goals', props: ['total', 'attempts'] as const },
  { apiKey: 'freethrows_goals', props: ['total', 'attempts'] as const },
  { apiKey: 'rebounds', props: ['total', 'offence', 'defense'] as const },
  { apiKey: 'assists' },
  { apiKey: 'steals' },
  { apiKey: 'blocks' },
  { apiKey: 'turnovers' },
  { apiKey: 'personal_fouls' },
] as const

export const TEAM_STATS_SYNC: Record<string, number> = {
  batchSize: 10,
  delayMs: 300,
  timeoutMs: 30_000,
}

export const PLAYER_STAT_COLUMNS = [
  { apiKey: 'field_goals', props: ['total', 'attempts'] as const },
  { apiKey: 'threepoint_goals', props: ['total', 'attempts'] as const },
  { apiKey: 'freethrows_goals', props: ['total', 'attempts'] as const },
  { apiKey: 'rebounds', props: ['total'] as const },
  { apiKey: 'assists' },
  { apiKey: 'points' },
  { apiKey: 'plus_minus' },
] as const

export const PLAYER_STATS_SYNC = { delayMs: 250 } as const

export const FINISHED_GAME_REGEX = /^(FT|AOT)$/i
