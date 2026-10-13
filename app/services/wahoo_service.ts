import { DateTime } from 'luxon'
import axios, { type AxiosRequestConfig } from 'axios'
import env from '#start/env'
import logger from '@adonisjs/core/services/logger'
import AthleteProvider from '#models_pg/athlete_provider'
import Activity from '#models_pg/activity'
import Period from '#models_pg/period'
import Serie from '#models_pg/serie'
import SportActivity from '#models_pg/sport_activity'
import { ATHLETE_PROVIDER_TYPES } from '#constants/athlete_provider.constants'
import {
  WAHOO_API_BASE_URL,
  WAHOO_MAX_NATIVE_FITNESS_APP_ID,
  WAHOO_OAUTH_SCOPES,
  WAHOO_SYNC_LIMIT,
} from '#constants/wahoo.constants'
import type {
  WahooTokenResponse,
  WahooUser,
  WahooWorkout,
  WahooWorkoutSummary,
  WahooWorkoutSummaryWebhook,
  WahooWorkoutsResponse,
} from '#contracts/wahoo'
import AthleteService from '#services/athlete_service'
import { SportActivityService } from '#services/sport_activity_service'
import { EventService } from '#services/event_service'
import { buildSeriesFromFitSamples, downloadAndParseFitSamples } from '#utils/fit'

export class WahooService {
  private athleteService = new AthleteService()
  private sportActivityService = new SportActivityService()
  private eventService = new EventService()

  buildAuthorizationUrl(): string {
    const params = new URLSearchParams({
      client_id: env.get('WAHOO_CLIENT_ID'),
      redirect_uri: env.get('WAHOO_REDIRECT_URI'),
      scope: WAHOO_OAUTH_SCOPES.join(' '),
      response_type: 'code',
    })

    return `${WAHOO_API_BASE_URL}/oauth/authorize?${params}`
  }

  async exchangeCodeForTokens(code: string): Promise<WahooTokenResponse> {
    const { data } = await axios.post<WahooTokenResponse>(
      `${WAHOO_API_BASE_URL}/oauth/token`,
      null,
      {
        params: {
          client_id: env.get('WAHOO_CLIENT_ID'),
          client_secret: env.get('WAHOO_CLIENT_SECRET'),
          code,
          redirect_uri: env.get('WAHOO_REDIRECT_URI'),
          grant_type: 'authorization_code',
        },
      }
    )

    return data
  }

  async getAuthenticatedUser(accessToken: string): Promise<WahooUser> {
    const { data } = await axios.get<WahooUser>(`${WAHOO_API_BASE_URL}/v1/user`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })

    return data
  }

  async upsertProviderForAthlete(
    athleteId: string,
    tokens: WahooTokenResponse,
    wahooUser: WahooUser
  ): Promise<AthleteProvider> {
    const provider =
      (await AthleteProvider.query()
        .where('athleteId', athleteId)
        .where('provider', ATHLETE_PROVIDER_TYPES.WAHOO)
        .first()) ??
      (await AthleteProvider.create({
        athleteId,
        provider: ATHLETE_PROVIDER_TYPES.WAHOO,
      }))

    provider.accessToken = tokens.access_token
    provider.refreshToken = tokens.refresh_token
    provider.tokenExpiresAt = DateTime.now().plus({ seconds: tokens.expires_in })
    provider.providerAthleteId = String(wahooUser.id)
    await provider.save()

    return provider
  }

  async getProviderForAthlete(athleteId: string): Promise<AthleteProvider | null> {
    return AthleteProvider.query()
      .where('athleteId', athleteId)
      .where('provider', ATHLETE_PROVIDER_TYPES.WAHOO)
      .first()
  }

  async getProviderByWahooUserId(wahooUserId: number): Promise<AthleteProvider | null> {
    return AthleteProvider.query()
      .where('provider', ATHLETE_PROVIDER_TYPES.WAHOO)
      .where('providerAthleteId', String(wahooUserId))
      .first()
  }

  async getValidAccessToken(provider: AthleteProvider): Promise<string> {
    if (!provider.accessToken) {
      throw new Error('Wahoo access token is missing')
    }

    if (!provider.refreshToken) {
      return provider.accessToken
    }

    const expiresAt = provider.tokenExpiresAt
    if (expiresAt && expiresAt > DateTime.now().plus({ minutes: 5 })) {
      return provider.accessToken
    }

    const { data } = await axios.post<WahooTokenResponse>(
      `${WAHOO_API_BASE_URL}/oauth/token`,
      null,
      {
        params: {
          client_id: env.get('WAHOO_CLIENT_ID'),
          client_secret: env.get('WAHOO_CLIENT_SECRET'),
          grant_type: 'refresh_token',
          refresh_token: provider.refreshToken,
        },
      }
    )

    provider.accessToken = data.access_token
    provider.refreshToken = data.refresh_token
    provider.tokenExpiresAt = DateTime.now().plus({ seconds: data.expires_in })
    await provider.save()

    return data.access_token
  }

  async apiRequest<T>(
    provider: AthleteProvider,
    config: Omit<AxiosRequestConfig, 'headers'> & { headers?: Record<string, string> },
    retries = 2
  ): Promise<{ data: T; remaining5Min: number | null; resetSeconds: number }> {
    const accessToken = await this.getValidAccessToken(provider)

    try {
      const response = await axios.request<T>({
        ...config,
        url: config.url?.startsWith('http') ? config.url : `${WAHOO_API_BASE_URL}${config.url}`,
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          ...config.headers,
        },
      })

      const remainingParts = String(response.headers['x-ratelimit-remaining'] ?? '')
        .split(',')
        .map((part) => Number(part.trim()))
      const resetSeconds = Number(response.headers['x-ratelimit-reset']) || 0

      return {
        data: response.data,
        remaining5Min: Number.isFinite(remainingParts[2]) ? remainingParts[2] : null,
        resetSeconds,
      }
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 429 && retries > 0) {
        const waitSeconds = Number(error.response.headers['x-ratelimit-reset']) || 60
        logger.warn({ waitSeconds, url: config.url }, 'Wahoo 429, waiting for reset')
        await new Promise((resolve) => setTimeout(resolve, waitSeconds * 1000))
        return this.apiRequest(provider, config, retries - 1)
      }
      throw error
    }
  }

  async deauthorize(provider: AthleteProvider): Promise<void> {
    try {
      await this.apiRequest(provider, {
        method: 'DELETE',
        url: '/v1/permissions',
      })
    } catch (error) {
      const status = axios.isAxiosError(error) ? error.response?.status : undefined
      logger.warn({ status }, 'Wahoo deauthorize failed, clearing local tokens anyway')
    }

    provider.accessToken = null
    provider.refreshToken = null
    provider.tokenExpiresAt = null
    await provider.save()
  }

  async getWorkouts(
    provider: AthleteProvider,
    page = 1,
    perPage = WAHOO_SYNC_LIMIT
  ): Promise<{
    data: WahooWorkoutsResponse
    remaining5Min: number | null
    resetSeconds: number
  }> {
    return this.apiRequest<WahooWorkoutsResponse>(provider, {
      method: 'GET',
      url: '/v1/workouts',
      params: { page, per_page: perPage },
    })
  }

  async syncHistoricalWorkouts(
    athleteId: string
  ): Promise<{ total: number; queued: number; skipped: number }> {
    const provider = await this.getProviderForAthlete(athleteId)
    if (!provider?.accessToken) {
      throw new Error(`No Wahoo provider with access token for athlete ${athleteId}`)
    }

    const wahooUserId = Number(provider.providerAthleteId)
    if (!Number.isFinite(wahooUserId)) {
      throw new Error(`Invalid Wahoo user id for athlete ${athleteId}`)
    }

    const { default: ProcessWahooWorkoutJob } = await import('#jobs/process_wahoo_workout_job')
    const { data: response } = await this.getWorkouts(provider, 1, WAHOO_SYNC_LIMIT)

    let queued = 0
    let skipped = 0

    for (const workout of response.workouts) {
      const summary = workout.workout_summary
      // Only BIKING from Wahoo apps (fitness_app_id < 1000)
      if (
        !summary ||
        workout.workout_type_id !== 0 ||
        (summary.fitness_app_id != null &&
          summary.fitness_app_id >= WAHOO_MAX_NATIVE_FITNESS_APP_ID)
      ) {
        skipped++
        continue
      }

      await ProcessWahooWorkoutJob.dispatch(this.buildProcessPayload(wahooUserId, workout))
      queued++
    }

    logger.info(
      { athleteId, wahooUserId, fetched: response.workouts.length, queued, skipped },
      'Wahoo historical workouts sync queued'
    )

    return { total: response.workouts.length, queued, skipped }
  }

  buildProcessPayload(wahooUserId: number, workout: WahooWorkout): WahooWorkoutSummaryWebhook {
    const summary = workout.workout_summary!
    return {
      event_type: 'workout_summary',
      webhook_token: env.get('WAHOO_WEBHOOK_TOKEN'),
      user: { id: wahooUserId },
      workout_summary: {
        ...summary,
        workout: {
          id: workout.id,
          starts: workout.starts,
          minutes: workout.minutes,
          name: workout.name,
          workout_token: workout.workout_token,
          workout_type_id: workout.workout_type_id,
          plan_id: workout.plan_id,
          created_at: workout.created_at,
          updated_at: workout.updated_at,
        },
      },
    }
  }

  async processWorkoutSummaryWebhook(payload: WahooWorkoutSummaryWebhook): Promise<void> {
    if (payload.webhook_token !== env.get('WAHOO_WEBHOOK_TOKEN')) {
      throw new Error('Invalid Wahoo webhook token')
    }

    const provider = await this.getProviderByWahooUserId(payload.user.id)
    if (!provider) {
      logger.warn('No athlete provider found for Wahoo user %s', payload.user.id)
      return
    }

    await this.processWorkoutSummary(provider, payload.workout_summary)
  }

  async processWorkoutSummary(
    provider: AthleteProvider,
    workoutSummary: WahooWorkoutSummary
  ): Promise<void> {
    const workout = workoutSummary.workout
    if (workout?.workout_type_id !== 0) return
    if (
      workoutSummary.fitness_app_id != null &&
      workoutSummary.fitness_app_id >= WAHOO_MAX_NATIVE_FITNESS_APP_ID
    ) {
      return
    }

    if (!provider.athlete) {
      await provider.load('athlete')
    }
    const athlete = provider.athlete
    if (!athlete) {
      logger.warn('No athlete found for Wahoo provider %s', provider.id)
      return
    }

    const providerId = `wahoo:${workout.id}`
    const existingPeriod = await Period.query().where('providerId', providerId).first()
    if (existingPeriod) return

    const startIso = workoutSummary.started_at ?? workout.starts
    const activityDate = DateTime.fromISO(startIso, { setZone: true })
    if (!activityDate.isValid) {
      logger.warn(
        { startedAt: workoutSummary.started_at, starts: workout.starts, workoutId: workout.id },
        'Invalid Wahoo workout start'
      )
      return
    }

    const activity = await Activity.query().where('name', 'Cycle').first()
    if (!activity) {
      logger.warn('Activity "Cycle" not found')
      return
    }

    const day = await this.athleteService.getOrCreateDay(String(athlete.id), activityDate)

    const n = (v: string | null | undefined) => {
      const parsed = Number(v)
      return Number.isFinite(parsed) && parsed !== 0 ? parsed : null
    }

    const distanceMeters = n(workoutSummary.distance_accum)
    const speedMps = n(workoutSummary.speed_avg)
    const durationSeconds =
      n(workoutSummary.duration_active_accum) ?? n(workoutSummary.duration_total_accum)
    const ascent = n(workoutSummary.ascent_accum)
    const cadence = n(workoutSummary.cadence_avg)
    const power = n(workoutSummary.power_avg)
    const hr = n(workoutSummary.heart_rate_avg)
    const calories = n(workoutSummary.calories_accum)

    const fitUrl = workoutSummary.file?.url ?? null
    const fitSamples = fitUrl ? await downloadAndParseFitSamples(fitUrl) : []
    const series = buildSeriesFromFitSamples(fitSamples)

    const workoutName = workoutSummary.name ?? workout.name ?? 'Wahoo Ride'

    const sportActivity = await SportActivity.create({
      dayId: day.id,
      activityTypeId: activity.id,
      activityName: workoutName,
      timeOfActivity: activityDate.toFormat('HH:mm:ss'),
      dataSource: 'wahoo',
      distance: distanceMeters !== null ? Math.round((distanceMeters / 1000) * 100) / 100 : null,
      speed: speedMps !== null ? Math.round(speedMps * 3.6 * 100) / 100 : null,
      durationSeconds,
      elevation: ascent !== null ? Math.round(ascent) : null,
      cadence: cadence !== null ? Math.round(cadence) : null,
      power: power !== null ? Math.round(power) : null,
      averagedBpm: hr !== null ? Math.round(hr) : null,
      activeCalories: calories !== null ? Math.round(calories) : null,
    })

    const period = await Period.create({
      providerId,
      sportActivityId: sportActivity.id,
      name: workoutName,
      startTime: activityDate,
      endTime: activityDate.plus({ seconds: durationSeconds || 0 }),
    })

    if (series.length > 0) {
      await Serie.createMany(series.map((serie) => ({ ...serie, periodId: period.id })))
    }

    await this.sportActivityService.calculateTrainingLoad(sportActivity.id, true)
    await this.eventService.syncSportActivityToCalendar(sportActivity)

    logger.info(
      {
        athleteId: athlete.id,
        sportActivityId: sportActivity.id,
        providerId,
        fitUrl: fitUrl ?? null,
        seriesCount: series.length,
        sampleCount: fitSamples.length,
      },
      'Created sport activity from Wahoo workout'
    )
  }
}
