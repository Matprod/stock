import type { HttpContext } from '@adonisjs/core/http'
import ApiBasketballService from '#services/api_basketball_service'
import { PeriodMetricService } from '#services/period_metric_service'
import Period from '#models_pg/period'
import logger from '@adonisjs/core/services/logger'
import {
  BASKETBALL_SYNC_DAYS,
  DEFAULT_LNB_SEASON,
  JL_BOURG_TEAM_ID,
} from '#constants/basketball.constants'
import {
  listTeamGamesSchema,
  listGamesOnlySchema,
  getGameStatsSchema,
  getPeriodIdSchema,
  updatePeriodMetricsSchema,
} from '#schemas/basketball'
import SlackService from '#services/slack_service'

import { BasketballService } from '#services/api_basketball_service'

export default class BasketballController {
  private readonly basketballApi: ApiBasketballService
  private readonly periodMetricService: PeriodMetricService
  private readonly basketballService: BasketballService
  private readonly slackService: SlackService

  constructor() {
    this.basketballApi = new ApiBasketballService()
    this.periodMetricService = new PeriodMetricService()
    this.basketballService = new BasketballService()
    this.slackService = new SlackService()
  }

  private async notifyMatchFailure(): Promise<void> {
    try {
      await this.slackService.sendMessage(':rotating_light: Basketball endpoint failed.', 'match')
    } catch (slackError) {
      logger.warn({ error: slackError }, 'Failed to send Slack endpoint failure alert')
    }
  }

  private getFetchGamesOptions(payload: {
    all_leagues?: string
    season_lnb?: string
    season_eurocup?: string
    season_leaders_cup?: string
  }) {
    return {
      allLeagues: payload.all_leagues === 'true',
      seasonLnb: payload.season_lnb,
      seasonEurocup: payload.season_eurocup,
      seasonLeadersCup: payload.season_leaders_cup,
    }
  }

  private parseGameParams(payload: {
    season?: string
    team?: string
    league?: string
  }): { season?: string; team?: number; league?: number } | null {
    if (!payload.season && !payload.team && !payload.league) {
      return null
    }
    const params: { season?: string; team?: number; league?: number } = {}

    if (payload.season) params.season = payload.season
    if (payload.team) {
      const teamNum = parseInt(payload.team, 10)
      if (Number.isNaN(teamNum)) return null
      params.team = teamNum
    }
    if (payload.league) {
      const leagueNum = parseInt(payload.league, 10)
      if (Number.isNaN(leagueNum)) return null
      params.league = leagueNum
    }

    return params
  }

  public async listTeamGames({ request, response }: HttpContext) {
    try {
      const payload = await listTeamGamesSchema.validate(request.qs())

      const teamId = payload.team ? Number(payload.team) : JL_BOURG_TEAM_ID
      if (Number.isNaN(teamId)) {
        return response.badRequest({ message: 'Invalid team parameter' })
      }

      const params = {
        season: payload.season ?? DEFAULT_LNB_SEASON,
        teamId,
        league: payload.league ? Number(payload.league) : undefined,
        allLeagues: payload.all_leagues === 'true',
        seasonLnb: payload.season_lnb,
        seasonEurocup: payload.season_eurocup,
        seasonLeadersCup: payload.season_leaders_cup,
      }

      if (params.league !== undefined && Number.isNaN(params.league)) {
        return response.badRequest({ message: 'Invalid league parameter' })
      }

      const data = await this.basketballService.fetchGamesData(params)

      if (payload.include_stats !== 'true') {
        return response.ok(data)
      }

      const statsByGame = await this.basketballService.processGamesWithStats(data.response, teamId)
      return response.ok({ ...data, playerStats: statsByGame })
    } catch (error) {
      if (error instanceof Error && error.message.includes('validation')) {
        return response.badRequest({ message: 'Invalid request parameters', error: error.message })
      }
      logger.error({ error }, 'BasketballController: listTeamGames failed')
      return response.internalServerError({ message: 'Failed to fetch basketball games' })
    }
  }

  public async listGamesOnly({ request, response }: HttpContext) {
    try {
      const payload = await listGamesOnlySchema.validate(request.qs())
      const params = this.parseGameParams(payload)

      if (!params) {
        return response.badRequest({ message: 'Invalid team or league parameter' })
      }

      const data = await this.basketballService.fetchGamesData({
        ...params,
        ...this.getFetchGamesOptions(payload),
      })
      return response.ok(data)
    } catch (error) {
      if (error instanceof Error && error.message.includes('validation')) {
        return response.badRequest({ message: 'Invalid request parameters', error: error.message })
      }
      logger.error({ error }, 'BasketballController: listGamesOnly failed')
      return response.internalServerError({ message: 'Failed to list games' })
    }
  }

  public async getGameStats({ params, response }: HttpContext) {
    try {
      const { gameId } = await getGameStatsSchema.validate({ gameId: params.gameId })

      const [statistics, players] = await Promise.all([
        this.basketballApi.fetchGameStatistics(String(gameId)),
        this.basketballApi.fetchGamePlayers(String(gameId)),
      ])
      return response.ok({ statistics, players })
    } catch (error) {
      if (error instanceof Error && error.message.includes('validation')) {
        return response.badRequest({ message: 'Invalid game id parameter', error: error.message })
      }
      logger.error({ error, gameId: params.gameId }, 'BasketballController: getGameStats failed')
      return response.internalServerError({ message: 'Failed to get game stats' })
    }
  }

  public async storeGames({ request, response, auth }: HttpContext) {
    try {
      const payload = await listGamesOnlySchema.validate(request.qs())
      const params = this.parseGameParams(payload)
      if (params === null) {
        return response.badRequest({ message: 'Invalid team or league parameter' })
      }
      const options = this.getFetchGamesOptions(payload)

      const days = payload.days ?? BASKETBALL_SYNC_DAYS
      const teamId = params.team ?? JL_BOURG_TEAM_ID

      const data = await this.basketballService.fetchGamesDataForLastDays(days, {
        teamId,
        league: params?.league,
        allLeagues: options.allLeagues,
        season: params?.season,
        seasonLnb: options.seasonLnb,
        seasonEurocup: options.seasonEurocup,
        seasonLeadersCup: options.seasonLeadersCup,
      })
      const games = data ?? []
      if (games.length === 0) {
        return response.ok({ message: 'No games found', stored: 0 })
      }

      try {
        const storedGames = await this.basketballService.storeGamesInDatabase(
          games,
          auth.user!.clubId
        )

        return response.ok({
          message: 'Games stored successfully',
          total: games.length,
          stored: storedGames.length,
        })
      } catch (storeError) {
        logger.error(
          { error: storeError, clubId: auth.user!.clubId },
          'BasketballController: storeGames failed'
        )
        await this.notifyMatchFailure()
        return response.internalServerError({
          message: 'Failed to store games',
          error: storeError instanceof Error ? storeError.message : String(storeError),
        })
      }
    } catch (error) {
      if (error instanceof Error && error.message.includes('validation')) {
        return response.badRequest({ message: 'Invalid request parameters', error: error.message })
      }
      logger.error({ error }, 'BasketballController: storeGames failed')
      await this.notifyMatchFailure()
      return response.internalServerError({ message: 'Failed to store games' })
    }
  }

  public async updatePeriodMetrics({ params, request, response, auth }: HttpContext) {
    try {
      const { periodId } = await getPeriodIdSchema.validate({ periodId: params.periodId })
      const payload = await updatePeriodMetricsSchema.validate(request.body())
      const { metrics } = payload

      const period = await Period.query()
        .where('id', periodId)
        .whereHas('sportActivity', (query) =>
          query.where('day.athlete.clubId', auth.user!.clubId)
        )
        .preload('sportActivity', (query) =>
          query.preload('day', (dayQuery) => dayQuery.preload('athlete'))
        )
        .first()
      if (!period) {
        return response.notFound({ message: 'Period not found' })
      }

      const basketballMetricsMap = await this.basketballService.getBasketballMetricsMap()

      const updatedPeriod = await this.periodMetricService.updatePeriodMetrics(periodId, metrics, {
        periodValidation: { dataSource: 'api_basket' },
        metricValidation: { allowedMetricNames: new Set(basketballMetricsMap.keys()) },
        trainingLoadRecalculator: this.basketballService,
      })

      return response.ok({
        message: 'Metrics updated successfully',
        period: updatedPeriod.toJSON(),
      })
    } catch (error) {
      if (error instanceof Error && error.message.includes('validation')) {
        return response.badRequest({ message: 'Invalid request body', error: error.message })
      }
      if (error instanceof Error) {
        if (error.message.includes('not found'))
          return response.notFound({ message: error.message })
        if (error.message.includes('Invalid') || error.message.includes('invalid')) {
          return response.badRequest({ message: error.message })
        }
      }
      return response.internalServerError({ message: 'Failed to update period metrics' })
    }
  }
}
