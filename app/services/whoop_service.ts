import crypto from 'node:crypto'
import { DateTime } from 'luxon'
import axios, { type AxiosRequestConfig } from 'axios'
import env from '#start/env'
import logger from '@adonisjs/core/services/logger'
import AthleteProvider from '#models_pg/athlete_provider'
import Activity from '#models_pg/activity'
import Period from '#models_pg/period'
import Sleep from '#models_pg/sleep'
import SportActivity from '#models_pg/sport_activity'
import { ATHLETE_PROVIDER_TYPES } from '#constants/athlete_provider.constants'
import {
  WHOOP_API_ORIGIN,
  WHOOP_DEVELOPER_API_BASE_URL,
  WHOOP_OAUTH_SCOPES,
} from '#constants/whoop.constants'
import type {
  WhoopSleep,
  WhoopTokenResponse,
  WhoopUserBasicProfile,
  WhoopWebhookPayload,
  WhoopWorkout,
} from '#contracts/whoop'
import AthleteService from '#services/athlete_service'
import { SportActivityService } from '#services/sport_activity_service'
import { EventService } from '#services/event_service'
import { buildWhoopWorkoutMetrics, mapWhoopSport, resolveWhoopLocalRange } from '#utils/whoop'

const DS = 'whoop' as const

export class WhoopService {
  private athleteService = new AthleteService()
  private sportActivityService = new SportActivityService()
  private eventService = new EventService()

  buildAuthorizationUrl(): string {
    const params = new URLSearchParams({
      client_id: env.get('WHOOP_CLIENT_ID'),
      redirect_uri: env.get('WHOOP_REDIRECT_URI'),
      scope: WHOOP_OAUTH_SCOPES.join(' '),
      response_type: 'code',
      state: crypto.randomBytes(4).toString('hex'),
    })
    return `${WHOOP_API_ORIGIN}/oauth/oauth2/auth?${params}`
  }

  async exchangeCodeForTokens(code: string): Promise<WhoopTokenResponse> {
    return this.requestToken({
      grant_type: 'authorization_code',
      code,
      redirect_uri: env.get('WHOOP_REDIRECT_URI'),
      client_id: env.get('WHOOP_CLIENT_ID'),
      client_secret: env.get('WHOOP_CLIENT_SECRET'),
    })
  }

  async getAuthenticatedUser(accessToken: string): Promise<WhoopUserBasicProfile> {
    const { data } = await axios.get<WhoopUserBasicProfile>(
      `${WHOOP_DEVELOPER_API_BASE_URL}/v2/user/profile/basic`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    )
    return data
  }

  async upsertProviderForAthlete(
    athleteId: string,
    tokens: WhoopTokenResponse,
    whoopUser: WhoopUserBasicProfile
  ): Promise<AthleteProvider> {
    const provider =
      (await AthleteProvider.query()
        .where('athleteId', athleteId)
        .where('provider', ATHLETE_PROVIDER_TYPES.WHOOP)
        .first()) ??
      (await AthleteProvider.create({ athleteId, provider: ATHLETE_PROVIDER_TYPES.WHOOP }))

    provider.accessToken = tokens.access_token
    provider.refreshToken = tokens.refresh_token
    provider.tokenExpiresAt = DateTime.now().plus({ seconds: tokens.expires_in })
    provider.providerAthleteId = String(whoopUser.user_id)
    await provider.save()
    return provider
  }

  async getProviderForAthlete(athleteId: string): Promise<AthleteProvider | null> {
    return AthleteProvider.query()
      .where('athleteId', athleteId)
      .where('provider', ATHLETE_PROVIDER_TYPES.WHOOP)
      .first()
  }

  async deauthorize(provider: AthleteProvider): Promise<void> {
    await this.apiRequest(provider, { method: 'DELETE', url: '/v2/user/access' })
    await provider.delete()
  }

  async processWebhook(payload: WhoopWebhookPayload): Promise<void> {
    const { type, user_id: userId, id: objectId } = payload
    if (!type || !userId || !objectId) throw new Error('Missing required Whoop webhook fields')

    const provider = await AthleteProvider.query()
      .where('provider', ATHLETE_PROVIDER_TYPES.WHOOP)
      .where('providerAthleteId', String(userId))
      .preload('athlete')
      .first()

    if (!provider) {
      logger.warn('No athlete provider found for Whoop user %s', userId)
      return
    }

    if (type === 'workout.deleted') {
      await this.deleteWhoopWorkout(objectId)
      return
    }
    if (type === 'workout.updated') {
      await this.processWhoopWorkout(
        await this.apiRequest<WhoopWorkout>(provider, {
          method: 'GET',
          url: `/v2/activity/workout/${objectId}`,
        }),
        provider
      )
      return
    }
    if (type === 'sleep.updated') {
      await this.processWhoopSleep(
        await this.apiRequest<WhoopSleep>(provider, {
          method: 'GET',
          url: `/v2/activity/sleep/${objectId}`,
        }),
        provider
      )
    }
  }

  private async processWhoopSleep(sleep: WhoopSleep, provider: AthleteProvider): Promise<void> {
    if (sleep.score_state !== 'SCORED' || !sleep.score) return
    if (!provider.athlete) await provider.load('athlete')
    if (!provider.athlete) return

    const { startLocal, endLocal } = resolveWhoopLocalRange(
      sleep.start,
      sleep.end,
      sleep.timezone_offset
    )
    const day = await this.athleteService.getOrCreateDay(
      String(provider.athlete.id),
      sleep.nap ? startLocal : endLocal
    )
    const stage = sleep.score.stage_summary
    const needed = sleep.score.sleep_needed

    try {
      if (sleep.nap) {
        const napMs =
          stage.total_in_bed_time_milli ||
          Math.max(0, Math.round(endLocal.diff(startLocal).as('milliseconds')))
        await Sleep.updateOrCreate(
          { dayId: day.id },
          {
            dayId: day.id,
            dataSource: DS,
            ...(startLocal.hour < 12 ? { napAm: napMs } : { napPm: napMs }),
          }
        )
        return
      }

      await Sleep.updateOrCreate(
        { dayId: day.id },
        {
          dayId: day.id,
          dataSource: DS,
          bedtimeDate: startLocal,
          wakeUpDate: endLocal,
          totalInBedTimeMilli: stage.total_in_bed_time_milli,
          totalAwakeTimeMilli: stage.total_awake_time_milli,
          totalSlowWaveSleepTimeMilli: stage.total_slow_wave_sleep_time_milli,
          totalRemSleepTimeMilli: stage.total_rem_sleep_time_milli,
          sleepEfficiencyPercentage: sleep.score.sleep_efficiency_percentage ?? null,
          sleepConsistencyPercentage: sleep.score.sleep_consistency_percentage ?? null,
          needFromSleepDebtMilli: needed.need_from_sleep_debt_milli,
          baselineMili: needed.baseline_milli,
        }
      )
    } catch (err) {
      logger.error({ err, sleepId: sleep.id }, 'Failed to upsert Whoop sleep')
    }
  }

  private async processWhoopWorkout(
    workout: WhoopWorkout,
    provider: AthleteProvider
  ): Promise<void> {
    const activityName = mapWhoopSport(workout.sport_name)
    if (!activityName) {
      logger.warn({ whoopSport: workout.sport_name, workoutId: workout.id }, 'Unknown Whoop sport')
      return
    }
    if (!provider.athlete) await provider.load('athlete')
    if (!provider.athlete) return

    const range = resolveWhoopLocalRange(workout.start, workout.end, workout.timezone_offset)
    if (range.durationSeconds <= 0) return

    const day = await this.athleteService.getOrCreateDay(
      String(provider.athlete.id),
      range.startLocal
    )
    const activity = await Activity.query().where('name', activityName).first()
    if (!activity) {
      logger.warn('Activity not found: %s', activityName)
      return
    }

    const metrics = await buildWhoopWorkoutMetrics(
      workout,
      activity.id,
      provider.athlete.clubId,
      range.durationSeconds
    )
    const fields = {
      dayId: day.id,
      activityTypeId: activity.id,
      timeOfActivity: range.startLocal.toFormat('HH:mm:ss'),
      dataSource: DS,
      ...metrics,
    }

    try {
      const existing = await Period.query()
        .where('providerId', workout.id)
        .whereHas('sportActivity', (q) => q.where('dataSource', DS))
        .preload('sportActivity')
        .first()

      if (existing?.sportActivity) {
        existing.sportActivity.merge(fields)
        await existing.sportActivity.save()
        existing.merge({
          startTime: range.startLocal,
          endTime: range.endLocal,
          name: `Whoop ${workout.sport_name}`,
        })
        await existing.save()
        await this.sportActivityService.calculateTrainingLoad(existing.sportActivity.id, true)
        if (!existing.sportActivity.eventId) {
          await this.eventService.syncSportActivityToCalendar(existing.sportActivity)
        }
        return
      }

      const sportActivity = await SportActivity.create(fields)
      await Period.create({
        providerId: workout.id,
        sportActivityId: sportActivity.id,
        name: `Whoop ${workout.sport_name}`,
        startTime: range.startLocal,
        endTime: range.endLocal,
      })
      await this.sportActivityService.calculateTrainingLoad(sportActivity.id, true)
      await this.eventService.syncSportActivityToCalendar(sportActivity)
    } catch (err) {
      logger.error({ err, workoutId: workout.id, activityName }, 'Failed to upsert Whoop workout')
    }
  }

  private async deleteWhoopWorkout(workoutId: string): Promise<void> {
    const period = await Period.query()
      .where('providerId', workoutId)
      .whereHas('sportActivity', (q) => q.where('dataSource', DS))
      .preload('sportActivity')
      .first()
    if (!period?.sportActivity) return

    const sportActivityId = period.sportActivity.id
    await SportActivity.query().where('id', sportActivityId).delete()
  }

  private async requestToken(body: Record<string, string>): Promise<WhoopTokenResponse> {
    const { data } = await axios.post<WhoopTokenResponse>(
      `${WHOOP_API_ORIGIN}/oauth/oauth2/token`,
      new URLSearchParams(body),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    )
    return data
  }

  private async getValidAccessToken(provider: AthleteProvider): Promise<string> {
    if (!provider.accessToken) throw new Error('Whoop access token is missing')
    if (
      !provider.refreshToken ||
      (provider.tokenExpiresAt && provider.tokenExpiresAt > DateTime.now().plus({ minutes: 5 }))
    ) {
      return provider.accessToken
    }

    const tokens = await this.requestToken({
      grant_type: 'refresh_token',
      refresh_token: provider.refreshToken,
      client_id: env.get('WHOOP_CLIENT_ID'),
      client_secret: env.get('WHOOP_CLIENT_SECRET'),
      scope: 'offline',
    })
    provider.accessToken = tokens.access_token
    provider.refreshToken = tokens.refresh_token
    provider.tokenExpiresAt = DateTime.now().plus({ seconds: tokens.expires_in })
    await provider.save()
    return tokens.access_token
  }

  private async apiRequest<T>(
    provider: AthleteProvider,
    config: Omit<AxiosRequestConfig, 'headers'> & { headers?: Record<string, string> }
  ): Promise<T> {
    const accessToken = await this.getValidAccessToken(provider)
    const { data } = await axios.request<T>({
      ...config,
      url: config.url?.startsWith('http')
        ? config.url
        : `${WHOOP_DEVELOPER_API_BASE_URL}${config.url}`,
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        ...config.headers,
      },
    })
    return data
  }
}
