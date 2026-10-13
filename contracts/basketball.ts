import type { POSITIONS } from '#constants/basketball.constants'
import type { GamesQueryParams } from '#contracts/api_basketball'

export type PositionType = (typeof POSITIONS)[keyof typeof POSITIONS][number]

type GamesQueryParamsWithTeamId = Omit<GamesQueryParams, 'team'> & {
  teamId: number
}

type BaseFetchParams = Pick<GamesQueryParamsWithTeamId, 'teamId' | 'season' | 'league' | 'date'>

export type FetchGamesDataParams = Partial<BaseFetchParams> & {
  teamId?: number
  team?: number
  allLeagues?: boolean
  seasonLnb?: string
  seasonEurocup?: string
  seasonLeadersCup?: string
}

export type FetchLnbAndEurocupGamesParams = Partial<Pick<BaseFetchParams, 'teamId' | 'league'>> & {
  teamId: number
  seasonLnb: string
  seasonEurocup: string
}

export type FetchLeagueGamesForDateParams = Partial<BaseFetchParams> & {
  teamId: number
}

export type BasketballGameStatus =
  | 'NS'
  | 'Q1'
  | 'Q2'
  | 'Q3'
  | 'Q4'
  | 'OT'
  | 'BT'
  | 'HT'
  | 'FT'
  | 'AOT'
  | 'POST'
  | 'CANC'
  | 'SUSP'
  | 'AWD'
  | 'ABD'
