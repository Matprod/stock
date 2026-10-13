export type DflServiceConfig = {
  maunaClubId: string
  dflClubId: string
  clientId: string
  baseUrl?: string
}

export type DflClubSyncResult = {
  clubId: string
  matches: number
  imported: number
  activitiesUpdated: number
  activitiesCreated: number
  skipped: number
  failed: number
  errors: string[]
  error?: string
}

export type DflRecord = Record<string, string>

export type DflSeason = {
  seasonId: string
  name: string
}

export type DflFixture = {
  matchId: string
  kickoff: string
  homeTeamId: string
  awayTeamId: string
  homeTeamName: string
  awayTeamName: string
}

export type DflPlayerMatchMetrics = {
  personId: string
  teamId: string | null
  matchId: string
  matchDate: string
  matchName: string | null
  kickoffTime: string | null
  minutesPlayed: number | null
  totalDistance: number | null
  sprintDistance: number | null
  intensiveRunDistance: number | null
  maxSpeed: number | null
  tacklesContested: number | null
  tacklesWon: number | null
}
