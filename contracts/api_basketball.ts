export type BasketballApiConfig = {
  baseUrl: string
  apiKey: string
}

export type GamesQueryParams = {
  id?: string
  date?: string
  league?: number
  season?: string
  team?: number
}

export type ShotStats = {
  total: number | null
  attempts: number | null
  percentage: number | null
}

export type GameStatus = {
  long: string | null
  short: string | null
  timer: string | null
}

export type GameTeamInfo = {
  id: number
  name: string
  logo: string | null
}

export type GameScoreInfo = {
  quarter_1: number | null
  quarter_2: number | null
  quarter_3: number | null
  quarter_4: number | null
  over_time: number | null
  total: number | null
}

export type GameInfo = {
  id: number
  date: string
  time: string | null
  timestamp: number
  stage: string | null
  status: GameStatus
  league: {
    id: number
    name: string
    type: string | null
    season: string | null
    logo: string | null
  }
  country: {
    id: number
    name: string
    code: string | null
    flag: string | null
  }
  teams: {
    home: GameTeamInfo
    away: GameTeamInfo
  }
  scores: {
    home: GameScoreInfo
    away: GameScoreInfo
  }
  matchResult: string
}

export type GameStatisticsEntry = {
  game: {
    id: number
  }
  team: {
    id: number
    name?: string
  }
  player: {
    id: number
    name: string
  }
  type: string | null
  minutes: string | null
  field_goals: ShotStats | null
  threepoint_goals: ShotStats | null
  freethrows_goals: ShotStats | null
  rebounds: {
    total: number | null
  }
  assists: number | null
  points: number | null
  plus_minus?: number | null
}

export type GameStatisticsResponse = {
  response: GameStatisticsEntry[]
  results?: number
  errors?: Record<string, string>
}

export type GamePlayersResponse = {
  response: Array<{
    game: {
      id: number
    }
    team: {
      id: number
      name: string
    }
    players: Array<{
      id: number
      name: string
      starter: boolean
      pos: string | null
      number: string | null
      minutes: string | null
    }>
  }>
}

export type GamesResponse = {
  response: GameInfo[]
  results?: number
  errors?: Record<string, string>
}

export type PlayerGameStatSummary = {
  playerId: number | null
  playerName: string | null
  type: string | null
  minutes: string | null
  fieldGoals: ShotStats
  threePointGoals: ShotStats
  freeThrowGoals: ShotStats
  rebounds: GameStatisticsEntry['rebounds']
  assists: number | null
  points: number | null
}

export type PlayerRosterEntry = {
  playerId: number | null
  playerName: string | null
  position: string | null
  number: string | null
  starter: boolean | null
  minutes: string | null
}

export type GameStatsWithRoster = {
  gameId: number
  statistics: PlayerGameStatSummary[]
  roster: PlayerRosterEntry[]
}

export type CreateActivityFromStatsParams = {
  athleteId: string
  game: GameInfo
  stats: GameStatisticsEntry
  teamApiId: number
  playerPositionName?: string | null
}

export type MetricPayload = {
  raw: Record<string, number | null>
  calculated: Record<string, number | null>
  combined: Record<string, number | null>
}

export type ExternalTrainingLoadDetails = {
  value: number | null
  component1: number | null
  component2: number | null
  x1: number | null
  x2: number | null
}

export type TrainingLoadConfig = {
  metric1: string
  metric2: string
  coeff1: number
  coeff2: number
}

export type TrainingLoadComponents = {
  component1: number | null
  component2: number | null
  adjusted1: number | null
  adjusted2: number | null
  finalValue: number | null
}

export type TeamStatisticsRebounds = {
  total: number | null
  offence: number | null
  defense: number | null
}

export type TeamStatisticsEntry = {
  game: {
    id: number
  }
  team: {
    id: number
    name?: string
  }
  field_goals: ShotStats | null
  threepoint_goals: ShotStats | null
  freethrows_goals: ShotStats | null
  rebounds: TeamStatisticsRebounds | null
  assists: number | null
  steals: number | null
  blocks: number | null
  turnovers: number | null
  personal_fouls: number | null
}

export type TeamStatisticsResponse = {
  response: TeamStatisticsEntry[]
  results?: number
  errors?: Record<string, string>
}

export type TeamStatisticsQueryParams = {
  id?: string
  ids?: string
}

export type PropsMergePeriodForExistingActivityParams = {
  game: GameInfo
  activityName: string
  secondsOnCourt: number | null
  athleteId: string
  playerPositionName: string | null | undefined
  stats: GameStatisticsEntry
}

export type PropsNewActivityFromStatsParams = {
  game: GameInfo
  activityName: string
  timeOfActivity: string
  durationSeconds: number | null
  secondsOnCourt: number | null
  athleteId: string
  playerPositionName: string | null | undefined
  stats: GameStatisticsEntry
}

export interface PlayerStatPayload {
  apiPlayerId: number
  athleteId?: string | null
}

export interface GamePayload {
  playerStats?: PlayerStatPayload[]
}

export interface EnrichedEventPayload {
  basketballGames?: GamePayload[]
}
