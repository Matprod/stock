import type {
  GameStatisticsEntry,
  GamePlayersResponse,
  PlayerGameStatSummary,
  PlayerRosterEntry,
} from '#contracts/api_basketball'

export const BASKETBALL_ACTIVITY_TYPE_ID = 28

//Calculates True Shooting Percentage (TS%), a basketball metric that measures shooting efficiency
export function calculateTrueShootingPercentage(points: number, fga: number, fta: number): number {
  const denominator = 2 * (fga + 0.44 * fta)
  if (denominator <= 0) return 0
  return Math.min(1.0, Math.max(0, points / denominator))
}

export function extractPositionStats(rawStats: Record<string, number | null>) {
  return {
    twoPM: rawStats.basketball_2pm ?? 0,
    twoPA: rawStats.basketball_2pa ?? 0,
    threePM: rawStats.basketball_3pm ?? 0,
    threePA: rawStats.basketball_3pa ?? 0,
    ftm: rawStats.basketball_ftm ?? 0,
    fta: rawStats.basketball_fta ?? 0,
    assists: rawStats.basketball_assists ?? 0,
    rebounds: rawStats.basketball_rebounds ?? 0,
    points: Math.max(0, rawStats.basketball_points ?? 0),
    fga: (rawStats.basketball_2pa ?? 0) + (rawStats.basketball_3pa ?? 0),
  }
}

export function mapStatisticsEntry(entry: GameStatisticsEntry): PlayerGameStatSummary {
  const emptyShotStats = { total: null, attempts: null, percentage: null }
  return {
    playerId: entry.player.id ?? null,
    playerName: entry.player.name ?? null,
    type: entry.type ?? null,
    minutes: entry.minutes ?? null,
    fieldGoals: entry.field_goals ?? emptyShotStats,
    threePointGoals: entry.threepoint_goals ?? emptyShotStats,
    freeThrowGoals: entry.freethrows_goals ?? emptyShotStats,
    rebounds: entry.rebounds ?? { total: null },
    assists: entry.assists ?? null,
    points: entry.points ?? null,
  }
}

export function extractRoster(
  playersResponse: GamePlayersResponse,
  teamId: number,
  teamStats: GameStatisticsEntry[]
): PlayerRosterEntry[] {
  const teamPlayers = playersResponse.response.find(
    (entry) => entry.team.id === teamId
  )

  if (teamPlayers?.players) {
    return mapPlayersToRoster(teamPlayers.players)
  }

  return mapStatsToRoster(teamStats)
}

export function mapPlayersToRoster(
  players: GamePlayersResponse['response'][number]['players']
): PlayerRosterEntry[] {
  return players.map((player) => ({
    playerId: player.id ?? null,
    playerName: player.name ?? null,
    position: player.pos ?? null,
    number: player.number ?? null,
    starter: player.starter ?? null,
    minutes: player.minutes ?? null,
  }))
}

export function mapStatsToRoster(teamStats: GameStatisticsEntry[]): PlayerRosterEntry[] {
  return teamStats.map((stat) => ({
    playerId: stat.player.id,
    playerName: stat.player.name,
    position: null,
    number: null,
    starter: stat.type === 'starters',
    minutes: stat.minutes,
  }))
}
