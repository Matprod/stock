import vine from '@vinejs/vine'

export const listTeamGamesSchema = vine.compile(
  vine.object({
    season: vine.string().optional(),
    team: vine.string().optional(),
    league: vine.string().optional(),
    include_stats: vine.string().optional(),
    all_leagues: vine.string().optional(),
    season_lnb: vine.string().optional(),
    season_eurocup: vine.string().optional(),
    season_leaders_cup: vine.string().optional(),
  })
)

export const listGamesOnlySchema = vine.compile(
  vine.object({
    season: vine.string().optional(),
    team: vine.string().optional(),
    league: vine.string().optional(),
    all_leagues: vine.string().optional(),
    season_lnb: vine.string().optional(),
    season_eurocup: vine.string().optional(),
    season_leaders_cup: vine.string().optional(),
    days: vine.number().min(1).max(365).optional(),
  })
)

export const getGameStatsSchema = vine.compile(
  vine.object({
    gameId: vine.number(),
  })
)

export const getPeriodIdSchema = vine.compile(
  vine.object({
    periodId: vine.string(),
  })
)

export const updatePeriodMetricsSchema = vine.compile(
  vine.object({
    metrics: vine.record(vine.unionOfTypes([vine.number(), vine.string()])),
  })
)
