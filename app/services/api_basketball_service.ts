import axios from 'axios'
import { DateTime } from 'luxon'
import env from '#start/env'
import AthleteService from '#services/athlete_service'
import SportActivity from '#models_pg/sport_activity'
import Period from '#models_pg/period'
import PeriodMetric from '#models_pg/period_metric'
import { PeriodMetricService } from '#services/period_metric_service'
import { SportActivityService } from '#services/sport_activity_service'
import {
  BASKETBALL_METRICS,
  BASKETBALL_SYNC_DAYS,
  JL_BOURG_TEAM_ID,
  DEFAULT_LNB_SEASON,
  DEFAULT_EUROCUP_SEASON,
  DEFAULT_LEADERS_CUP_SEASON,
  LNB_LEAGUE_ID,
  EUROCUP_LEAGUE_ID,
  LEADERS_CUP_LEAGUE_ID,
  DEFAULT_BASKETBALL_CLUB_ID,
  TEAM_STAT_COLUMNS,
  TEAM_STATS_SYNC,
  PLAYER_STAT_COLUMNS,
  PLAYER_STATS_SYNC,
  FINISHED_GAME_REGEX,
} from '#constants/basketball.constants'
import logger from '@adonisjs/core/services/logger'
import SlackService from '#services/slack_service'
import {
  BASKETBALL_ACTIVITY_TYPE_ID,
  mapStatisticsEntry,
  extractRoster,
} from '../utils/training_loads/basketball/basketball.js'
import { BasketballTrainingLoad } from '../utils/training_loads/basketball/training_load.js'
import { toCamel } from '../utils/basketball.js'

import type {
  BasketballApiConfig,
  GamesQueryParams,
  GamePlayersResponse,
  GameStatisticsResponse,
  GamesResponse,
  GameInfo,
  GameStatisticsEntry,
  CreateActivityFromStatsParams,
  GameStatsWithRoster,
  PlayerGameStatSummary,
  PlayerRosterEntry,
  TeamStatisticsEntry,
  TeamStatisticsResponse,
  TeamStatisticsQueryParams,
  PropsNewActivityFromStatsParams,
  PropsMergePeriodForExistingActivityParams,
  GamePayload,
} from '#contracts/api_basketball'
import type { FetchGamesDataParams } from '#contracts/basketball'
import { parseMinutesToSeconds } from '../utils/time.js'
import AthleteProvider from '#models_pg/athlete_provider'
import { ATHLETE_PROVIDER_TYPES } from '#constants/athlete_provider.constants'
import BasketballGame from '#models_pg/basketball_game'
import BasketballGameStat from '#models_pg/basketball_game_stat'
import BasketballGamePlayerStat from '#models_pg/basketball_game_player_stat'
import db from '@adonisjs/lucid/services/db'
import { TransactionClientContract } from '@adonisjs/lucid/types/database'
import Event from '#models_pg/event'
import EventType from '#models_pg/event_type'
import { EVENT_CATEGORY } from '#constants/event.constants'
import Day from '#models_pg/day'
import { BasketballGameStatus } from '#contracts/basketball'
import { APP_LANGUAGES } from '#utils/localize'

const ALL_LEAGUES_CONFIG = [
  { league: LNB_LEAGUE_ID, season: DEFAULT_LNB_SEASON },
  { league: EUROCUP_LEAGUE_ID, season: DEFAULT_EUROCUP_SEASON },
  { league: LEADERS_CUP_LEAGUE_ID, season: '2026' },
] as const

export default class ApiBasketballService {
  private readonly baseUrl: string
  private readonly headers: Record<string, string>
  private readonly timeout = 10_000

  constructor(
    config: BasketballApiConfig = {
      baseUrl: env.get('API_BASKETBALL_URL') as string,
      apiKey: env.get('API_BASKETBALL_KEY') as string,
    }
  ) {
    const parsedUrl = new URL(config.baseUrl)
    this.baseUrl = config.baseUrl
    this.headers = {
      'x-rapidapi-key': config.apiKey,
      'x-rapidapi-host': parsedUrl.hostname,
    }
  }

  private async request<T>(
    endpoint: string,
    params: Record<string, unknown>,
    timeout: number = this.timeout
  ): Promise<T> {
    const response = await axios.get<T>(`${this.baseUrl}${endpoint}`, {
      params,
      headers: this.headers,
      timeout,
    })
    return response.data
  }

  public async fetchGames(params: GamesQueryParams): Promise<GamesResponse> {
    return this.request<GamesResponse>('/games', params)
  }

  public async fetchGameStatistics(gameId: string): Promise<GameStatisticsResponse> {
    return this.request<GameStatisticsResponse>('/games/statistics/players', { id: gameId })
  }

  public async fetchGamePlayers(gameId: string): Promise<GamePlayersResponse> {
    return this.request<GamePlayersResponse>('/games/players', { id: gameId })
  }

  public async fetchGameTeamStatistics(
    params: TeamStatisticsQueryParams
  ): Promise<TeamStatisticsEntry[]> {
    const data = await this.request<TeamStatisticsResponse>(
      '/games/statistics/teams',
      params,
      TEAM_STATS_SYNC['timeoutMs']
    )
    return data.response ?? []
  }
}

export class BasketballService {
  private readonly athleteService: AthleteService
  private readonly periodMetricService: PeriodMetricService
  private readonly sportActivityService: SportActivityService
  private readonly apiBasketballService: ApiBasketballService
  private readonly slackService: SlackService

  constructor() {
    this.athleteService = new AthleteService()
    this.periodMetricService = new PeriodMetricService()
    this.sportActivityService = new SportActivityService()
    this.apiBasketballService = new ApiBasketballService()
    this.slackService = new SlackService()
  }

  public async getBasketballMetricsMap(): Promise<Map<string, PeriodMetric>> {
    const metrics = await PeriodMetric.query().whereIn('name', [...BASKETBALL_METRICS])
    return new Map(metrics.map((metric) => [metric.name, metric]))
  }

  public async computeBasketballExternalLoad(
    activityId: string,
    options?: {
      useHistorical?: boolean
      positionName?: string
      historicalActivities?: SportActivity[]
      updateTrainingLoad?: boolean
    }
  ): Promise<number | null> {
    return this.sportActivityService.computeBasketballExternalLoad(activityId, options)
  }

  private toGamesQueryParams<T extends { teamId: number }>({
    teamId,
    season,
    league,
    date,
    id,
  }: T & Partial<Pick<GamesQueryParams, 'season' | 'league' | 'date' | 'id'>>): GamesQueryParams {
    return {
      team: teamId,
      ...(season !== undefined && { season }),
      ...(league !== undefined && { league }),
      ...(date !== undefined && { date }),
      ...(id !== undefined && { id }),
    }
  }

  public async fetchRecentGames(
    days: number,
    teamId: number,
    league: number,
    season: string
  ): Promise<GameInfo[]> {
    const startDate = DateTime.now().minus({ days })
    const processedGameIds = new Set<number>()
    const allGames: GameInfo[] = []

    for (let i = 0; i < days; i++) {
      const dateString = startDate.plus({ days: i }).toFormat('yyyy-MM-dd')
      const games = await this.apiBasketballService
        .fetchGames(
          this.toGamesQueryParams({
            date: dateString,
            league,
            season,
            teamId,
          })
        )
        .then((result) => result.response ?? [])
        .catch((error) => {
          logger.warn(
            {
              err: error,
              date: dateString,
              league,
              season,
              teamId,
            },
            'Error fetching recent games'
          )
          return []
        })

      for (const game of games) {
        if (!processedGameIds.has(game.id)) {
          processedGameIds.add(game.id)
          allGames.push(game)
        }
      }

      await new Promise((resolve) => setTimeout(resolve, 200))
    }
    return allGames
  }

  private mergeAndSortGames(games: GameInfo[]): GameInfo[] {
    const byId = new Map<number, GameInfo>()
    for (const game of games) byId.set(game.id, game)
    return Array.from(byId.values()).sort((a, b) => a.date.localeCompare(b.date))
  }

  private async fetchRecentGamesForLeagues(
    days: number,
    teamId: number,
    leagues: readonly { league: number; season: string }[]
  ): Promise<GameInfo[]> {
    const results = await Promise.all(
      leagues.map(({ league, season }) => this.fetchRecentGames(days, teamId, league, season))
    )
    return this.mergeAndSortGames(results.flat())
  }

  public async fetchGamesDataForLastDays(
    days: number,
    params: {
      teamId: number
      league?: number
      allLeagues?: boolean
      season?: string
      seasonLnb?: string
      seasonEurocup?: string
      seasonLeadersCup?: string
    }
  ): Promise<GameInfo[]> {
    const season = params.season ?? DEFAULT_LNB_SEASON
    if (params.league != null) {
      const games = await this.fetchRecentGames(days, params.teamId, params.league, season)
      return games
    }
    if (params.allLeagues) {
      const leagues = ALL_LEAGUES_CONFIG.map(({ league, season }) => ({
        league,
        season: season,
      }))
      const games = await this.fetchRecentGamesForLeagues(days, params.teamId, leagues)
      return games
    }
    const games = await this.fetchRecentGames(days, params.teamId, LNB_LEAGUE_ID, season)
    return games
  }

  public async fetchGamesData(params: FetchGamesDataParams): Promise<GamesResponse> {
    const teamId = params.teamId ?? params.team
    const allLeagues = params.allLeagues === true

    if (teamId == null) {
      return this.apiBasketballService.fetchGames({
        team: params.team,
        season: params.season,
        league: params.league,
      })
    }
    if (params.league != null || !allLeagues) {
      return this.apiBasketballService.fetchGames(
        this.toGamesQueryParams({
          teamId,
          season: params.season ?? DEFAULT_LNB_SEASON,
          league: params.league,
          date: params.date,
        })
      )
    }

    const games = await this.fetchAllLeaguesGames({
      teamId,
      seasonLnb: params.seasonLnb ?? params.season ?? DEFAULT_LNB_SEASON,
      seasonEurocup: params.seasonEurocup ?? DEFAULT_EUROCUP_SEASON,
      seasonLeadersCup: params.seasonLeadersCup ?? DEFAULT_LEADERS_CUP_SEASON,
    })
    return { response: games, results: games.length }
  }

  public async fetchAllLeaguesGames(params: {
    teamId: number
    seasonLnb: string
    seasonEurocup: string
    seasonLeadersCup: string
  }): Promise<GameInfo[]> {
    const leagueResponses = await Promise.all(
      ALL_LEAGUES_CONFIG.map(({ league, season }) =>
        this.apiBasketballService.fetchGames(
          this.toGamesQueryParams({
            teamId: params.teamId,
            season: season,
            league,
          })
        )
      )
    )
    return this.mergeAndSortGames(leagueResponses.flatMap((r) => r.response ?? []))
  }

  public async processGamesWithStats(
    games: GameInfo[],
    teamId: number
  ): Promise<GameStatsWithRoster[]> {
    const statsByGame: GameStatsWithRoster[] = []
    for (let i = 0; i < games.length; i++) {
      const { statistics, roster } = await this.fetchGameStatsAndRoster(games[i].id, teamId)
      statsByGame.push({ gameId: games[i].id, statistics, roster })
    }
    return statsByGame
  }

  private async fetchGameStatsAndRoster(
    gameId: number,
    teamId: number
  ): Promise<{ statistics: PlayerGameStatSummary[]; roster: PlayerRosterEntry[] }> {
    const [statsResponse, playersResponse] = await Promise.all([
      this.apiBasketballService.fetchGameStatistics(String(gameId)),
      this.apiBasketballService.fetchGamePlayers(String(gameId)),
    ])

    const teamStats = statsResponse.response.filter((entry) => entry.team.id === teamId)

    const statistics: PlayerGameStatSummary[] = teamStats.map(mapStatisticsEntry)
    const roster = extractRoster(playersResponse, teamId, teamStats)

    return { statistics, roster }
  }

  public async getAthleteSportActivities(athleteId: string): Promise<SportActivity[]> {
    return SportActivity.query()
      .whereHas('day', (query) => {
        query.where('athleteId', athleteId)
      })
      .andWhere('gameActivity', true)
      .preload('periods', (query) => {
        query.preload('metricValues', (query) => {
          query.preload('metric')
        })
      })
      .orderBy('createdAt', 'desc')
  }

  private calculateBasketballMetrics(
    stats: GameStatisticsEntry,
    playerPositionName: string,
    game: GameInfo
  ) {
    const raw = BasketballTrainingLoad.extractRawStats(stats)
    const calculated = BasketballTrainingLoad.calculatePositionMetrics(playerPositionName, raw)
    const combined = { ...raw, ...calculated }
    const matchResult = game.matchResult

    return {
      ...combined,
      basketball_match_result: matchResult,
    }
  }

  private async computeTrainingLoadForActivity(
    activityId: string,
    athleteId: string
  ): Promise<void> {
    const historicalActivities = await this.getAthleteSportActivities(athleteId)
    await this.sportActivityService.computeBasketballExternalLoad(activityId, {
      useHistorical: historicalActivities.length > 0,
      historicalActivities: historicalActivities.filter((a) => a.id !== activityId),
      updateTrainingLoad: true,
    })
  }

  private async findExistingPeriodForGame(
    gameId: number,
    athleteId: string
  ): Promise<SportActivity | null> {
    const existingPeriodForGame = await Period.query()
      .where('providerId', String(gameId))
      .whereHas('sportActivity', (query) => {
        query.where('dataSource', 'api_basket').whereHas('day', (dayQuery) => {
          dayQuery.where('athleteId', athleteId)
        })
      })
      .preload('sportActivity')
      .first()

    return existingPeriodForGame?.sportActivity ?? null
  }

  private async findExistingActivityForAthlete(
    athleteId: string,
    day: Day,
    timeOfActivity: string
  ): Promise<SportActivity | null> {
    if (!day.dateOfDay) {
      throw new Error(
        `Day (id: ${day.id}) has a null dateOfDay. This should never happen and indicates a data integrity issue.`
      )
    }
    const event = await Event.query()
      .whereHas('athletes', (query) => {
        query.where('id', athleteId)
      })
      .whereHas('eventType', (query) => {
        query.where('eventCategory', EVENT_CATEGORY.MATCHES)
      })
      .first()
    if (event) {
      return null
    }
    const manualActivity = await SportActivity.query()
      .whereHas('day', (query) => {
        query
          .where('athleteId', athleteId)
          .where('dateOfDay', day.dateOfDay!.toFormat('yyyy-MM-dd'))
      })
      .whereHas('event', (query) => {
        query.whereHas('eventType', (eventTypeQuery) => {
          eventTypeQuery.where('eventCategory', EVENT_CATEGORY.MATCHES)
        })
      })
      .where('dataSource', 'manual')
      .where('activityTypeId', String(BASKETBALL_ACTIVITY_TYPE_ID))
      .first()

    if (manualActivity) {
      return manualActivity
    }

    return SportActivity.query()
      .whereHas('day', (query) => {
        query
          .where('athleteId', athleteId)
          .where('dateOfDay', day.dateOfDay!.toFormat('yyyy-MM-dd'))
      })
      .where('timeOfActivity', timeOfActivity)
      .where('dataSource', 'api_basket')
      .where('activityTypeId', String(BASKETBALL_ACTIVITY_TYPE_ID))
      .first()
  }

  private async mergePeriodForExistingActivity(
    existingActivity: SportActivity,
    params: PropsMergePeriodForExistingActivityParams
  ): Promise<SportActivity> {
    const trx = await db.transaction()
    try {
      if (existingActivity.dataSource === 'manual') {
        existingActivity.useTransaction(trx)
        existingActivity.merge({
          dataSource: 'api_basket',
          ...(params.secondsOnCourt !== null && {
            durationSeconds: params.secondsOnCourt,
          }),
        })
        await existingActivity.save()
      }
      const period = await this.upsertActivityPeriod({
        sportActivity: existingActivity,
        game: params.game,
        activityName: params.activityName,
        secondsOnCourt: params.secondsOnCourt,
        trx,
      })
      const resolvedPlayerPositionName = await this.resolvePlayerPositionName(
        params.athleteId,
        params.playerPositionName
      )

      const metrics = this.calculateBasketballMetrics(
        params.stats,
        resolvedPlayerPositionName,
        params.game
      )
      await this.periodMetricService.storePeriodMetrics(period, metrics, {
        metricNames: [...BASKETBALL_METRICS],
        transaction: trx,
      })

      await trx.commit()
      await this.computeTrainingLoadForActivity(existingActivity.id, params.athleteId)
      return existingActivity
    } catch (error) {
      await trx.rollback()
      throw error
    }
  }

  private async createNewSportActivityWithPeriod(
    day: Day,
    params: PropsNewActivityFromStatsParams
  ): Promise<SportActivity> {
    const trx = await db.transaction()

    try {
      const sportActivity = await SportActivity.create(
        {
          dayId: day.id,
          activityTypeId: String(BASKETBALL_ACTIVITY_TYPE_ID),
          activityName: params.activityName,
          dataSource: 'api_basket',
          timeOfActivity: params.timeOfActivity,
          durationSeconds: params.durationSeconds,
          gameActivity: true,
        },
        { client: trx }
      )
      const period = await this.upsertActivityPeriod({
        sportActivity,
        game: params.game,
        activityName: params.activityName,
        secondsOnCourt: params.secondsOnCourt,
        trx,
      })
      const resolvedPlayerPositionName = await this.resolvePlayerPositionName(
        params.athleteId,
        params.playerPositionName
      )

      const metrics = this.calculateBasketballMetrics(
        params.stats,
        resolvedPlayerPositionName,
        params.game
      )
      await this.periodMetricService.storePeriodMetrics(period, metrics, {
        metricNames: [...BASKETBALL_METRICS],
        transaction: trx,
      })

      await trx.commit()
      await this.computeTrainingLoadForActivity(sportActivity.id, params.athleteId)

      return sportActivity
    } catch (error) {
      await trx.rollback()
      throw error
    }
  }

  public async persistSportActivity(
    params: CreateActivityFromStatsParams
  ): Promise<SportActivity | null> {
    const { athleteId, game, stats, playerPositionName } = params
    if (!game?.id) throw new Error('Game ID is required to persist sport activity')

    const ctx = { athleteId, gameId: game.id }
    try {
      const startTime = this.getGameStartTime(game)
      const timeOfActivity = startTime.toFormat('HH:mm:ss')
      const day = await this.athleteService.getOrCreateDay(athleteId, startTime)
      if (!day.dateOfDay) {
        throw new Error(
          `Failed to get or create athlete day with valid dateOfDay for athlete ${athleteId} at ${startTime.toISO()}`
        )
      }
      const secondsOnCourt = parseMinutesToSeconds(stats.minutes)
      const durationSeconds = secondsOnCourt
      const activityName = this.getGameTitle(game)
      const existingPeriodActivity = await this.findExistingPeriodForGame(game.id, athleteId)
      if (existingPeriodActivity)
        return this.mergePeriodForExistingActivity(existingPeriodActivity, {
          game,
          activityName,
          secondsOnCourt,
          athleteId,
          playerPositionName,
          stats,
        })

      const existingActivity = await this.findExistingActivityForAthlete(
        athleteId,
        day,
        timeOfActivity
      )
      if (existingActivity) {
        return this.mergePeriodForExistingActivity(existingActivity, {
          game,
          activityName,
          secondsOnCourt,
          athleteId,
          playerPositionName,
          stats,
        })
      }

      try {
        return await this.createNewSportActivityWithPeriod(day, {
          game,
          activityName,
          timeOfActivity,
          durationSeconds,
          secondsOnCourt,
          athleteId,
          playerPositionName,
          stats,
        })
      } catch (createError) {
        const activityToMerge = await this.findExistingActivityForAthlete(
          athleteId,
          day,
          timeOfActivity
        )

        if (!activityToMerge) throw createError

        return this.mergePeriodForExistingActivity(activityToMerge, {
          game,
          activityName,
          secondsOnCourt,
          athleteId,
          playerPositionName,
          stats,
        })
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error)
      logger.error({ ...ctx, error: msg }, 'persistSportActivity failed')
      throw error
    }
  }

  private async upsertActivityPeriod({
    sportActivity,
    game,
    activityName,
    secondsOnCourt,
    trx,
  }: {
    sportActivity: SportActivity
    game: GameInfo
    activityName: string
    secondsOnCourt: number | null
    trx: TransactionClientContract
  }): Promise<Period> {
    const gameStartTime = this.getGameStartTime(game)
    const gameEndTime = secondsOnCourt
      ? gameStartTime.plus({ seconds: secondsOnCourt })
      : gameStartTime.plus({ minutes: 48 })

    const existingPeriod = await Period.query({ client: trx })
      .where('sportActivityId', sportActivity.id)
      .where('providerId', String(game.id))
      .first()

    if (existingPeriod) {
      await existingPeriod
        .merge({ startTime: gameStartTime, endTime: gameEndTime, name: activityName })
        .save()
      return existingPeriod
    }
    return Period.create(
      {
        sportActivityId: sportActivity.id,
        providerId: String(game.id),
        name: activityName,
        startTime: gameStartTime,
        endTime: gameEndTime,
      },
      { client: trx }
    )
  }

  private async resolvePlayerPositionName(
    athleteId: string,
    providedName?: string | null
  ): Promise<string> {
    if (providedName) return providedName
    const positionName = await this.athleteService.getAthletePositionName(
      athleteId,
      APP_LANGUAGES.EN
    )
    if (!positionName) throw new Error('Athlete or player position not found')
    return positionName
  }

  private async buildAthleteMap(
    clubId: string
  ): Promise<Map<string, { athleteId: string; athleteName: string }>> {
    const athleteProviders = await AthleteProvider.query()
      .where('provider', ATHLETE_PROVIDER_TYPES.API_BASKETBALL)
      .whereHas('athlete', (query) => {
        query.where('clubId', clubId)
      })
      .preload('athlete')

    return athleteProviders.reduce((map, provider) => {
      if (provider.providerAthleteId === null) return map
      map.set(provider.providerAthleteId, {
        athleteId: provider.athleteId,
        athleteName: provider.athlete.name,
      })
      return map
    }, new Map<string, { athleteId: string; athleteName: string }>())
  }

  public async syncBasketballAthletes(
    clubId: string = String(DEFAULT_BASKETBALL_CLUB_ID)
  ): Promise<void> {
    const athleteMap = await this.buildAthleteMap(clubId)
    const periods = await Period.query()
      .whereNotNull('providerId')
      .whereHas('sportActivity', (q) => q.where('dataSource', 'api_basket'))
      .select('providerId')
    const processedGameIds = new Set<string>()
    for (const p of periods) {
      if (p.providerId) processedGameIds.add(p.providerId)
    }
    const games = await this.fetchRecentGamesForLeagues(
      BASKETBALL_SYNC_DAYS,
      JL_BOURG_TEAM_ID,
      ALL_LEAGUES_CONFIG
    )

    const gamesToProcess = games.filter((game) => {
      const statusShort = game.status.short ?? 'NS'
      const isFinished = FINISHED_GAME_REGEX.test(statusShort)
      const hasScores = game.scores.home.total !== null && game.scores.away.total !== null

      return (isFinished || hasScores) && !processedGameIds.has(String(game.id))
    })

    await this.processGamesForSync(gamesToProcess, athleteMap, processedGameIds)
  }

  private async processGamesForSync(
    games: GameInfo[],
    athleteMap: Map<string, { athleteId: string; athleteName: string }>,
    processedGameIds: Set<string>
  ): Promise<void> {
    const postedGameIds = new Set<number>()

    for (const game of games) {
      try {
        await this.handleSlackNotification(game, processedGameIds, postedGameIds)
        const [allStats, playerPositionsMap] = await this.fetchGameData(game)

        for (const stats of allStats) {
          const athlete = athleteMap.get(String(stats.player.id))
          if (!athlete) continue

          const { athleteId, athleteName } = athlete
          const playerPositionName = playerPositionsMap.get(stats.player.id) ?? 'Center (C)'

          await this.processPlayerStats({
            stats,
            game,
            athleteId,
            athleteName,
            playerPositionName,
          })
        }
      } catch (error) {
        logger.error({ error, gameId: game.id }, 'Failed to process basketball game in sync')
      }
    }
  }

  private async handleSlackNotification(
    game: GameInfo,
    processedGameIds: Set<string>,
    postedGameIds: Set<number>
  ): Promise<void> {
    const hasExistingActivity = processedGameIds.has(String(game.id))
    const alreadyPosted = postedGameIds.has(game.id)

    if (!hasExistingActivity && !alreadyPosted) {
      try {
        await this.slackService.postBasketballMatchResult(game)
        postedGameIds.add(game.id)
      } catch (error) {
        logger.error({ error, gameId: game.id }, 'Failed to post basketball match result to Slack')
      }
    }
  }

  private async fetchGameData(
    game: GameInfo
  ): Promise<[GameStatisticsEntry[], Map<number, string | null>]> {
    const [statsResponse, playersResponse] = await Promise.all([
      this.apiBasketballService.fetchGameStatistics(String(game.id)),
      this.apiBasketballService.fetchGamePlayers(String(game.id)).catch(() => ({ response: [] })),
    ])
    const allStats = (statsResponse?.response ?? []).filter(
      (stat) => stat.team.id === JL_BOURG_TEAM_ID
    )
    const playerPositionsMap = new Map<number, string | null>()
    for (const teamEntry of playersResponse?.response ?? []) {
      for (const player of teamEntry.players) {
        if (player.id) playerPositionsMap.set(player.id, player.pos ?? null)
      }
    }
    return [allStats, playerPositionsMap]
  }

  private async processPlayerStats({
    stats,
    game,
    athleteId,
    athleteName,
    playerPositionName,
  }: {
    stats: GameStatisticsEntry
    game: GameInfo
    athleteId: string
    athleteName: string
    playerPositionName: string
  }): Promise<{
    athleteName: string
    trainingLoad: number | null
    minutes: number
    points: number
    assists: number
    rebounds: number
  } | null> {
    const teamApiId = stats.team.id

    try {
      const { default: ProcessBasketballJob } = await import('#jobs/process_basketball_job')

      await ProcessBasketballJob.dispatch({
        athleteId,
        game,
        stats,
        teamApiId,
        playerPositionName,
      })

      const minutes =
        typeof stats.minutes === 'string' ? parseFloat(stats.minutes) : (stats.minutes ?? 0)

      return {
        athleteName,
        trainingLoad: null,
        minutes,
        points: stats.points ?? 0,
        assists: stats.assists ?? 0,
        rebounds: stats.rebounds?.total ?? 0,
      }
    } catch (error) {
      logger.error(
        {
          error: error instanceof Error ? error.message : String(error),
          athleteId,
          gameId: game.id,
        },
        'Failed to dispatch basketball job'
      )
      return null
    }
  }

  public async runStoreBasketballMatchsAllLeagues(
    clubId: string = String(DEFAULT_BASKETBALL_CLUB_ID)
  ): Promise<{ success: boolean; stored: number; total: number; error?: string }> {
    try {
      const games =
        (await this.fetchGamesData({ team: JL_BOURG_TEAM_ID, allLeagues: true })).response ?? []
      if (games.length === 0) return { success: true, stored: 0, total: 0 }
      const stored = await this.storeGamesInDatabase(games, clubId)
      return { success: true, stored: stored.length, total: games.length }
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error'
      logger.error({ error, clubId }, 'runStoreBasketballMatchsAllLeagues failed')
      return { success: false, stored: 0, total: 0, error: msg }
    }
  }

  private getGameStartTime(game: GameInfo): DateTime {
    return DateTime.fromSeconds(game.timestamp)
  }

  private getGameTitle(game: GameInfo): string {
    return `${game.teams.home.name} vs ${game.teams.away.name}`
  }

  private isGameFinished(statusShort: BasketballGameStatus | null | undefined): boolean {
    return statusShort != null && FINISHED_GAME_REGEX.test(statusShort)
  }

  private buildBasketballGameData(
    game: GameInfo,
    gameStartTime: DateTime,
    gameEndTime: DateTime,
    title: string
  ) {
    return {
      startTime: gameStartTime,
      endTime: gameEndTime,
      timestamp: game.timestamp,
      title,
      statusShort: game.status.short as BasketballGameStatus,
      leagueId: game.league.id,
      leagueName: game.league.name,
      leagueSeason: game.league.season,
      leagueLogo: game.league.logo,
      homeTeamId: game.teams.home.id,
      homeTeamName: game.teams.home.name,
      awayTeamId: game.teams.away.id,
      awayTeamName: game.teams.away.name,
      homeScoreQ1: game.scores.home.quarter_1,
      homeScoreQ2: game.scores.home.quarter_2,
      homeScoreQ3: game.scores.home.quarter_3,
      homeScoreQ4: game.scores.home.quarter_4,
      homeScoreOt: game.scores.home.over_time,
      homeScoreTotal: game.scores.home.total,
      awayScoreQ1: game.scores.away.quarter_1,
      awayScoreQ2: game.scores.away.quarter_2,
      awayScoreQ3: game.scores.away.quarter_3,
      awayScoreQ4: game.scores.away.quarter_4,
      awayScoreOt: game.scores.away.over_time,
      awayScoreTotal: game.scores.away.total,
    }
  }

  public async storeGamesInDatabase(games: GameInfo[], clubId: string): Promise<BasketballGame[]> {
    if (games.length === 0) {
      return []
    }

    const storedGames: BasketballGame[] = []
    let newGamesCount = false

    const apiGameIds = games.map((game) => game.id)
    const existingGames = await BasketballGame.query()
      .where('clubId', clubId)
      .whereIn('apiGameId', apiGameIds)

    const existingByApiGameId = new Map<number, BasketballGame>()
    for (const existingGame of existingGames) {
      existingByApiGameId.set(existingGame.apiGameId, existingGame)
    }

    for (const game of games) {
      try {
        const gameStartTime = this.getGameStartTime(game)
        const gameEndTime = gameStartTime.plus({ hours: 2 })

        const title = this.getGameTitle(game)

        const existingGame = existingByApiGameId.get(game.id)

        if (existingGame) {
          existingGame.merge(this.buildBasketballGameData(game, gameStartTime, gameEndTime, title))
          await existingGame.save()
          storedGames.push(existingGame)
        } else {
          const basketballGame = await BasketballGame.create({
            clubId,
            apiGameId: game.id,
            ...this.buildBasketballGameData(game, gameStartTime, gameEndTime, title),
          })
          newGamesCount = true
          storedGames.push(basketballGame)
        }
      } catch (error) {
        logger.error(
          {
            error: error instanceof Error ? error.message : String(error),
            gameId: game.id,
            clubId,
          },
          'Failed to store basketball game in database'
        )
      }
    }
    if (newGamesCount === false) {
      logger.info('All basketball games were skipped')
    }
    const finishedGames = storedGames.filter((game) => this.isGameFinished(game.statusShort))
    if (finishedGames.length > 0) {
      await this.syncBasketballGamesWithEvents(finishedGames, clubId)
    }

    const syncLimitDate = DateTime.now().minus({ days: BASKETBALL_SYNC_DAYS }).toJSDate()

    const recentClubGames = await BasketballGame.query()
      .where('clubId', clubId)
      .where('startTime', '>=', syncLimitDate)
      .orderBy('apiGameId')

    await this.syncTeamStats(recentClubGames).catch((error) => {
      logger.warn({ error, clubId }, 'Failed to sync team stats for basketball games.')
    })
    await this.syncPlayerStats(recentClubGames).catch((error) => {
      logger.warn({ error, clubId }, 'Failed to sync player stats for basketball games.')
    })

    return storedGames
  }

  private async syncTeamStats(games: BasketballGame[]): Promise<void> {
    if (games.length === 0) return

    const gameByApiId = new Map(games.map((g) => [g.apiGameId, g]))
    const apiGameIds = [...gameByApiId.keys()]
    const { batchSize, delayMs } = TEAM_STATS_SYNC

    for (let i = 0; i < apiGameIds.length; i += batchSize) {
      const idsParam = apiGameIds.slice(i, i + batchSize).join('-')

      const entries = await this.apiBasketballService
        .fetchGameTeamStatistics({ ids: idsParam })
        .catch((err) => {
          logger.warn({ ids: idsParam, error: err }, 'Failed to fetch team statistics')
          return []
        })

      const statsByGameId = new Map<
        string,
        { home: TeamStatisticsEntry | null; away: TeamStatisticsEntry | null }
      >()

      for (const entry of entries) {
        const game = gameByApiId.get(entry.game.id)
        if (!game) continue

        let slot = statsByGameId.get(game.id)
        if (!slot) statsByGameId.set(game.id, (slot = { home: null, away: null }))

        if (entry.team.id === game.homeTeamId) slot.home = entry
        else if (entry.team.id === game.awayTeamId) slot.away = entry
      }

      for (const [gameId, { home, away }] of statsByGameId) {
        await BasketballGameStat.updateOrCreate(
          { basketballGameId: gameId },
          { basketballGameId: gameId, ...this.buildTeamStatPayload(home, away) }
        )
      }

      if (i + batchSize < apiGameIds.length) {
        await new Promise((r) => setTimeout(r, delayMs))
      }
    }
  }

  private async syncPlayerStats(games: BasketballGame[]): Promise<void> {
    if (games.length === 0) return

    const gameByApiId = new Map(games.map((g) => [g.apiGameId, g]))
    const { delayMs } = PLAYER_STATS_SYNC

    for (const [apiGameId, game] of gameByApiId) {
      const response = await this.apiBasketballService
        .fetchGameStatistics(String(apiGameId))
        .catch(() => ({ response: [] as GameStatisticsEntry[] }))

      for (const entry of response.response ?? []) {
        const payload = this.buildPlayerStatPayload(entry, game.id)
        await BasketballGamePlayerStat.updateOrCreate(
          { basketballGameId: game.id, apiPlayerId: entry.player.id },
          { basketballGameId: game.id, ...payload }
        )
      }

      await new Promise((r) => setTimeout(r, delayMs))
    }
  }

  private buildPlayerStatPayload(
    entry: GameStatisticsEntry,
    basketballGameId: string
  ): Record<string, unknown> {
    const payload: Record<string, unknown> = {
      basketballGameId,
      apiPlayerId: entry.player.id,
      apiTeamId: entry.team.id,
      playerName: entry.player.name ?? null,
      type: entry.type ?? null,
      minutes: entry.minutes ?? null,
    }
    for (const col of PLAYER_STAT_COLUMNS) {
      if ('props' in col) {
        const obj = entry[col.apiKey as keyof GameStatisticsEntry] as
          | Record<string, number | null>
          | undefined
        for (const prop of col.props) payload[toCamel(col.apiKey, prop)] = obj?.[prop] ?? null
      } else {
        payload[toCamel(col.apiKey)] =
          (entry[col.apiKey as keyof GameStatisticsEntry] as number | null | undefined) ?? null
      }
    }
    return payload
  }

  private buildTeamStatPayload(
    home: TeamStatisticsEntry | null,
    away: TeamStatisticsEntry | null
  ): Record<string, number | null> {
    const payload: Record<string, number | null> = {}
    const key = (side: string, apiKey: string, prop?: string) =>
      side +
      apiKey
        .split('_')
        .map((s) => s[0].toUpperCase() + s.slice(1))
        .join('') +
      (prop ? prop[0].toUpperCase() + prop.slice(1) : '')

    const teams = [
      { side: 'home', entry: home },
      { side: 'away', entry: away },
    ] as const

    for (const { side, entry } of teams) {
      for (const col of TEAM_STAT_COLUMNS) {
        const statData = entry?.[col.apiKey as keyof TeamStatisticsEntry]

        if ('props' in col) {
          const obj = statData as Record<string, number | null> | undefined
          for (const prop of col.props) {
            payload[key(side, col.apiKey, prop)] = obj?.[prop] ?? null
          }
        } else {
          payload[key(side, col.apiKey)] = (statData as number | null) ?? null
        }
      }
    }

    return payload
  }

  private async getBasketballEventType(): Promise<EventType | null> {
    return EventType.query().where('eventCategory', EVENT_CATEGORY.MATCHES).first()
  }

  public async linkActivitiesToEvent(eventId: string): Promise<void> {
    const event = await Event.query().where('id', eventId).preload('basketballGames').first()
    if (!event || event.basketballGames.length === 0) return

    const clubId = event.clubId
    const apiGameIds = event.basketballGames.map((g) => g.apiGameId)
    const periods = await Period.query()
      .whereIn('providerId', apiGameIds.map(String))
      .preload('sportActivity')
    const sportActivityIds = periods
      .map((p) => p.sportActivity?.id)
      .filter((id): id is string => id != null)
    if (sportActivityIds.length === 0) return

    await SportActivity.query()
      .whereIn('id', sportActivityIds)
      .whereHas('day', (q) => {
        q.whereHas('athlete', (aq) => aq.where('clubId', clubId))
      })
      .whereNull('eventId')
      .update({ eventId })
  }

  public async addAthleteIdsToPlayerStats(payload: GamePayload[], clubId: string): Promise<void> {
    if (!payload?.length) return

    const apiPlayerIds = [
      ...new Set(payload.flatMap((g) => (g.playerStats ?? []).map((p) => p.apiPlayerId))),
    ]
    if (apiPlayerIds.length === 0) return

    const providers = await AthleteProvider.query()
      .where('provider', ATHLETE_PROVIDER_TYPES.API_BASKETBALL)
      .whereIn('providerAthleteId', apiPlayerIds.map(String))
      .whereHas('athlete', (query) => query.where('clubId', clubId))
      .select('athleteId', 'providerAthleteId')
    const apiToAthlete = new Map(
      providers.map((provider) => [provider.providerAthleteId ?? '', provider.athleteId])
    )

    for (const game of payload) {
      for (const stat of game.playerStats ?? []) {
        stat.athleteId = apiToAthlete.get(String(stat.apiPlayerId)) ?? null
      }
    }
  }

  private async syncBasketballGamesWithEvents(
    games: BasketballGame[],
    clubId: string
  ): Promise<void> {
    for (const game of games) {
      const eventType = await this.getBasketballEventType()
      if (!eventType) continue
      try {
        if (game.eventId) {
          const existingEvent = await Event.query()
            .where('id', game.eventId)
            .where('clubId', clubId)
            .first()

          if (existingEvent) {
            await this.updateEventWithGameDetails(existingEvent, game)
            continue
          }
        }

        const defaultEndTime = game.startTime.plus({ hours: 2 })
        const event = await this.findOrCreateMatchEvent({
          game,
          eventType,
          clubId,
          defaultEndTime,
        })

        const trx = await db.transaction()
        try {
          await game.merge({ eventId: event.id }).useTransaction(trx).save()
          await this.syncEventAthletesFromGame(event, game, clubId)
          await this.linkSportActivitiesToEvent(event, game, clubId)

          await trx.commit()
        } catch (error) {
          await trx.rollback()
          throw error
        }
      } catch (error) {
        logger.error(
          { error, gameId: game.id, clubId },
          'Failed to sync basketball game with event'
        )
      }
    }
  }

  private async updateEventWithGameDetails(event: Event, game: BasketballGame): Promise<void> {
    const updates: Partial<Event> = {}

    if (!event.location && game.location) {
      updates.location = game.location
    }

    if (Object.keys(updates).length > 0) {
      event.merge(updates)
      await event.save()
    }
  }

  private async getAthleteIdsFromGameStats(
    gameId: number,
    teamId: number,
    clubId: string
  ): Promise<string[]> {
    const statsResponse = await this.apiBasketballService.fetchGameStatistics(String(gameId))
    const teamStats = statsResponse.response.filter((entry) => entry.team.id === teamId)
    if (teamStats.length === 0) return []

    const playerIds = teamStats.map((stat) => String(stat.player.id))
    const athleteProviders = await AthleteProvider.query()
      .where('provider', ATHLETE_PROVIDER_TYPES.API_BASKETBALL)
      .whereHas('athlete', (q) => q.where('clubId', clubId))
      .whereIn('providerAthleteId', playerIds)
      .preload('athlete')
    return athleteProviders.map((p) => p.athleteId).filter((id): id is string => id !== null)
  }

  private async syncEventAthletesFromGame(
    event: Event,
    game: BasketballGame,
    clubId: string
  ): Promise<void> {
    try {
      const teamId = game.homeTeamId === JL_BOURG_TEAM_ID ? game.homeTeamId : game.awayTeamId
      const fromStats = await this.getAthleteIdsFromGameStats(game.apiGameId, teamId, clubId)
      const periods = await Period.query()
        .where('providerId', String(game.apiGameId))
        .preload('sportActivity', (q) => q.preload('day'))
      const withPeriods = [
        ...new Set(
          periods
            .map((p) => p.sportActivity?.day?.athleteId)
            .filter((id): id is string => id != null)
        ),
      ]
      const toSync = [...new Set([...fromStats, ...withPeriods])]
      if (toSync.length > 0) {
        await event.related('athletes').sync(toSync)
      }
    } catch (error) {
      logger.error(
        { error, eventId: event.id, gameId: game.id },
        'Failed to sync event athletes from game stats'
      )
    }
  }

  private async linkPeriodActivitiesToEvent(
    event: Event,
    game: BasketballGame,
    clubId: string
  ): Promise<void> {
    const periods = await Period.query()
      .where('providerId', String(game.apiGameId))
      .preload('sportActivity', (query) => {
        query.preload('day', (dayQuery) => {
          dayQuery.preload('athlete')
        })
      })
      .preload('metricValues', (metricQuery) => {
        metricQuery.preload('metric')
      })

    const sportActivityIds = periods
      .map((period) => period.sportActivity?.id)
      .filter((id): id is string => id !== null && id !== undefined)

    if (sportActivityIds.length > 0) {
      await SportActivity.query()
        .whereIn('id', sportActivityIds)
        .whereHas('day', (query) => {
          query.whereHas('athlete', (athleteQuery) => {
            athleteQuery.where('clubId', clubId)
          })
        })
        .update({ eventId: event.id })
    }
  }

  private async linkGameActivitiesToEvent(
    event: Event,
    game: BasketballGame,
    dayIds: string[]
  ): Promise<void> {
    if (dayIds.length === 0) {
      return
    }

    const gameActivities = await SportActivity.query()
      .whereIn('dayId', dayIds)
      .where('gameActivity', true)
      .where((query) => {
        query.where('dataSource', 'api_basket').orWhere('dataSource', 'manual')
      })
      .where((query) => {
        query.whereNull('eventId').orWhere('eventId', event.id)
      })
      .preload('periods', (periodQuery) => {
        periodQuery
          .where('providerId', String(game.apiGameId))
          .preload('metricValues', (metricQuery) => {
            metricQuery.preload('metric')
          })
      })

    if (gameActivities.length > 0) {
      await SportActivity.query()
        .whereIn(
          'id',
          gameActivities.map((a) => a.id)
        )
        .update({ eventId: event.id })
    }
  }

  private async ensureAllAthletesHaveActivity(
    event: Event,
    game: BasketballGame,
    athleteIds: string[]
  ): Promise<void> {
    if (athleteIds.length === 0) {
      return
    }

    const existingActivities = await SportActivity.query()
      .where('eventId', event.id)
      .whereHas('day', (query) => {
        query.whereIn('athleteId', athleteIds)
      })
      .preload('day')

    const athletesWithActivity = new Set(
      existingActivities.map((activity) => String(activity.day.athleteId))
    )
    const athletesWithoutActivity = athleteIds.filter((id) => !athletesWithActivity.has(id))

    if (athletesWithoutActivity.length === 0) {
      return
    }

    const gameDate = game.startTime.startOf('day')
    const gameDateEnd = game.startTime.endOf('day')

    const days = await Day.query()
      .whereIn('athleteId', athletesWithoutActivity)
      .whereBetween('dateOfDay', [gameDate.toJSDate(), gameDateEnd.toJSDate()])

    if (days.length === 0) {
      return
    }

    const dayIds = days.map((day) => day.id)

    const existingActivitiesByDate = await SportActivity.query()
      .whereIn('dayId', dayIds)
      .where('activityTypeId', String(BASKETBALL_ACTIVITY_TYPE_ID))
      .where((query) => {
        query.where('dataSource', 'manual').orWhere('dataSource', 'api_basket')
      })
      .where((query) => {
        query.whereNull('eventId').orWhere('eventId', event.id)
      })
      .preload('day')

    const existingByDayId = new Map<string, SportActivity>()
    const manualActivities = existingActivitiesByDate.filter((a) => a.dataSource === 'manual')
    const apiActivities = existingActivitiesByDate.filter((a) => a.dataSource === 'api_basket')
    for (const activity of [...manualActivities, ...apiActivities]) {
      if (!existingByDayId.has(activity.dayId)) {
        existingByDayId.set(activity.dayId, activity)
      }
    }

    const activitiesToLink: string[] = []

    for (const athleteId of athletesWithoutActivity) {
      const day = days.find((d) => d.athleteId === athleteId)
      if (!day) continue

      const existingActivity = existingByDayId.get(day.id)
      if (existingActivity && existingActivity.eventId !== event.id) {
        activitiesToLink.push(existingActivity.id)
      }
    }

    if (activitiesToLink.length > 0) {
      await SportActivity.query()
        .whereIn('id', activitiesToLink)
        .update({ eventId: event.id, gameActivity: true })
    }
  }

  private async linkSportActivitiesToEvent(
    event: Event,
    game: BasketballGame,
    clubId: string
  ): Promise<void> {
    try {
      const gameDate = game.startTime.startOf('day')
      const gameDateEnd = game.startTime.endOf('day')

      await this.linkPeriodActivitiesToEvent(event, game, clubId)

      const eventAthletes = await event.related('athletes').query()
      const athleteIds = eventAthletes.map((a) => a.id)

      if (athleteIds.length > 0) {
        const days = await Day.query()
          .whereIn('athleteId', athleteIds)
          .whereBetween('dateOfDay', [gameDate.toJSDate(), gameDateEnd.toJSDate()])

        const dayIds = days.map((day) => day.id)

        await this.linkGameActivitiesToEvent(event, game, dayIds)

        await this.ensureAllAthletesHaveActivity(event, game, athleteIds.map(String))
      }
    } catch (error) {
      logger.error(
        { error, eventId: event.id, gameId: game.id },
        'Failed to link sport activities to event'
      )
    }
  }

  private async findOrCreateMatchEvent({
    game,
    eventType,
    clubId,
    defaultEndTime,
  }: {
    game: BasketballGame
    eventType: EventType
    clubId: string
    defaultEndTime: DateTime
  }): Promise<Event> {
    if (game.apiGameId) {
      const existingWithSameGame = await Event.query()
        .where('clubId', clubId)
        .where('eventTypeId', eventType.id)
        .whereHas('basketballGames', (q) => q.where('apiGameId', game.apiGameId))
        .first()
      if (existingWithSameGame) {
        await this.updateEventWithGameDetails(existingWithSameGame, game)
        return existingWithSameGame
      }
    }

    const gameDayStart = game.startTime.startOf('day').toJSDate()
    const existingWithoutGame = await Event.query()
      .where({ clubId })
      .whereHas('eventType', (query) => {
        query.where('eventCategory', EVENT_CATEGORY.MATCHES)
      })
      .whereBetween('startTime', [gameDayStart, game.startTime.endOf('day').toJSDate()])
      .doesntHave('basketballGames')
      .first()

    if (existingWithoutGame) {
      await this.updateEventWithGameDetails(existingWithoutGame, game)
      return existingWithoutGame
    }

    return await Event.create({
      eventTypeId: eventType.id,
      startTime: game.startTime,
      endTime: defaultEndTime,
      title: game.title,
      location: game.location,
      clubId,
    })
  }
}
