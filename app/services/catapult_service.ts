import { CATAPULT_METRICS, CATAPULT_METRICS_TO_IMPUTE } from '#constants/catapult.constants'
import {
  CatapultApiResponse,
  CatapultClubSyncResult,
  CatapultImputationPayload,
  CatapultImputationResponse,
  CatapultMetric,
  CatapultPeriodSensorResponse,
  CatapultSeriesPayload,
  CatapultSensorPoint,
  CatapultServiceConfig,
} from '#contracts/catapult'
import SportActivity from '#models_pg/sport_activity'
import { CLUB_PROVIDER_TYPES } from '#constants/club_provider.constants'
import ClubProvider from '#models_pg/club_provider'
import env from '#start/env'
import db from '@adonisjs/lucid/services/db'
import axios from 'axios'
import { DateTime } from 'luxon'
import AthleteService from '#services/athlete_service'
import AthleteProvider from '#models_pg/athlete_provider'
import Athlete from '#models_pg/athlete'
import { ATHLETE_PROVIDER_TYPES } from '#constants/athlete_provider.constants'
import Period from '#models_pg/period'
import PeriodMetric from '#models_pg/period_metric'
import PeriodMetricValue from '#models_pg/period_metric_value'
import { MetricService } from '#services/metric_service'
import { EventService } from '#services/event_service'
import { MetricDomain } from '#contracts/metric'
import { DATA_TYPE, SERIE_TYPE } from '#constants/serie.constants'
import Serie from '#models_pg/serie'
import { getFootballActivityTypeId } from '#utils/football_activity'
import { encodeJsonPayload } from '../utils/statistics.js'
import { parsedPointSeries } from '../utils/series.js'

const CATAPULT_ENDPOINTS: Record<string, string> = {
  STATS: '/stats',
  ACTIVITIES: '/activities',
}

const CATAPULT_BASE_URL = 'https://connect-eu.catapultsports.com/api/v6'
const CATAPULT_FETCH_BATCH_SIZE = 10
const CATAPULT_FETCH_BATCH_DELAY_MS = 5000

export class CatapultService {
  private readonly clubId?: string
  private readonly token?: string
  private readonly teamId?: string
  private readonly imputationUrl: string
  private readonly athleteService: AthleteService
  private readonly metricService: MetricService
  private readonly eventService: EventService

  constructor(config?: CatapultServiceConfig) {
    this.imputationUrl = env.get('MACHINE_LEARNING_CATAPULT_IMPUTATION_URL')
    this.athleteService = new AthleteService()
    this.metricService = new MetricService(MetricDomain.PERIOD)
    this.eventService = new EventService()

    if (config) {
      this.clubId = config.clubId
      this.token = config.accessToken
      this.teamId = config.providerTeamId
    }
  }

  static fromClubProvider(provider: ClubProvider): CatapultService {
    if (!provider.accessToken || !provider.providerTeamId) {
      throw new Error(
        `Catapult provider misconfigured for club ${provider.clubId}: accessToken and providerTeamId are required`
      )
    }

    return new CatapultService({
      clubId: provider.clubId,
      accessToken: provider.accessToken,
      providerTeamId: provider.providerTeamId,
    })
  }

  static async fromClubId(clubId: string): Promise<CatapultService> {
    const provider = await ClubProvider.query()
      .where('clubId', clubId)
      .where('provider', CLUB_PROVIDER_TYPES.CATAPULT)
      .firstOrFail()

    return CatapultService.fromClubProvider(provider)
  }

  static async getConfiguredCatapultProviders(): Promise<ClubProvider[]> {
    return ClubProvider.query()
      .where('provider', CLUB_PROVIDER_TYPES.CATAPULT)
      .whereNotNull('accessToken')
      .whereNotNull('providerTeamId')
  }

  static async fetchAndQueueForAllClubs(
    startDate: DateTime,
    endDate?: DateTime
  ): Promise<CatapultClubSyncResult[]> {
    const providers = await CatapultService.getConfiguredCatapultProviders()

    if (providers.length === 0) {
      return []
    }

    const results: CatapultClubSyncResult[] = []

    for (const provider of providers) {
      try {
        const service = CatapultService.fromClubProvider(provider)
        const { activityCount, queuedJobs } = await service.fetchAndQueueActivities(
          startDate,
          endDate
        )

        provider.lastSyncedAt = DateTime.now()
        await provider.save()

        results.push({
          clubId: provider.clubId,
          activityCount,
          queuedJobs,
        })
      } catch (error) {
        results.push({
          clubId: provider.clubId,
          activityCount: 0,
          queuedJobs: 0,
          error: error instanceof Error ? error.message : 'Unknown error',
        })
      }
    }

    return results
  }

  public async fetchAndQueueActivities(
    startDate: DateTime,
    endDate?: DateTime
  ): Promise<{ activityCount: number; queuedJobs: number }> {
    this.assertApiConfigured()

    const activities = await this.getCatapultActivities(startDate, endDate)
    let queuedJobs = 0

    for (let i = 0; i < activities.length; i += CATAPULT_FETCH_BATCH_SIZE) {
      const batch = activities.slice(i, i + CATAPULT_FETCH_BATCH_SIZE)
      const allCatapultData = await Promise.all(
        batch.map((activity) => this.getCatapultData(activity.id))
      )

      const allPeriodsByAthleteAndActivity = this.groupPeriodsByAthleteAndActivity(
        allCatapultData.flat()
      )

      const catapultAthleteIds = Array.from(allPeriodsByAthleteAndActivity.values()).map(
        (v) => v.athleteId
      )

      const athleteProviders = await AthleteProvider.query()
        .where('provider', ATHLETE_PROVIDER_TYPES.CATAPULT)
        .whereIn('providerAthleteId', catapultAthleteIds)
        .preload('athlete', (athleteQuery) => {
          if (this.clubId !== undefined) {
            athleteQuery.where('clubId', this.clubId)
          }
        })

      const athleteMap = new Map<string, Athlete>()
      for (const provider of athleteProviders) {
        if (provider.providerAthleteId && provider.athlete) {
          athleteMap.set(provider.providerAthleteId, provider.athlete)
        }
      }

      const entriesToProcess = Array.from(allPeriodsByAthleteAndActivity.values()).filter(
        ({ athleteId }) => athleteMap.has(athleteId)
      )

      const { default: ProcessCatapultJob } = await import('#jobs/process_catapult_job')
      await Promise.all(
        entriesToProcess.map(({ athleteId, periods }) =>
          ProcessCatapultJob.dispatch({
            clubId: this.clubId!,
            athleteCatapultId: athleteId,
            periods,
          })
        )
      )

      queuedJobs += entriesToProcess.length

      if (i + CATAPULT_FETCH_BATCH_SIZE < activities.length) {
        await new Promise((resolve) => setTimeout(resolve, CATAPULT_FETCH_BATCH_DELAY_MS))
      }
    }

    return { activityCount: activities.length, queuedJobs }
  }

  private assertApiConfigured(): void {
    if (!this.token || !this.teamId || this.clubId === undefined) {
      throw new Error(
        'Catapult API is not configured for this service instance. Use CatapultService.fromClubProvider() or fromClubId().'
      )
    }
  }

  private getAuthHeaders(): Record<string, string> {
    this.assertApiConfigured()
    return {
      'Authorization': `Bearer ${this.token}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    }
  }

  public async getCatapultActivities(startDate: DateTime, endDate?: DateTime) {
    const url = `${CATAPULT_BASE_URL}${CATAPULT_ENDPOINTS.ACTIVITIES}`
    const response = await axios.get<Array<{ id: string }>>(url, {
      params: {
        team_id: this.teamId,
        start_time: startDate.toSeconds(),
        end_time: endDate?.toSeconds(),
      },
      headers: this.getAuthHeaders(),
    })
    return response.data
  }

  public async getCatapultData(sportActivityId: string) {
    const url = `${CATAPULT_BASE_URL}${CATAPULT_ENDPOINTS.STATS}`

    const response = await axios.post<Array<CatapultApiResponse>>(
      url,
      {
        filters: [
          {
            values: [sportActivityId],
            name: 'activity_id',
            comparison: '=',
          },
        ],
        group_by: ['athlete', 'period'],
        parameters: [...CATAPULT_METRICS, 'activity_name', 'activity_id'],
      },
      {
        headers: this.getAuthHeaders(),
      }
    )
    return response.data
  }

  public async getPeriodSensorData(
    periodId: string,
    catapultAthleteId: string,
    parameters: string = 'ts,hr',
    frequency: number = 1
  ) {
    const url = `${CATAPULT_BASE_URL}/periods/${periodId}/athletes/${catapultAthleteId}/sensor?parameters=${parameters}&frequency=${frequency}`
    const response = await axios.get<CatapultPeriodSensorResponse<CatapultSensorPoint>>(url, {
      headers: {
        Authorization: `Bearer ${this.token}`,
        Accept: 'application/json',
      },
    })
    return response.data
  }

  private encodeTimestampedSeriesFromSensorData<TKey extends string>(
    seriesData: Array<Record<string, unknown>>,
    valueKey: TKey
  ): string | null {
    const sanitizedPoints = parsedPointSeries(seriesData, valueKey)
    if (sanitizedPoints.length === 0) return null

    const points = sanitizedPoints.map(
      (point) =>
        ({ ts: point.ts, [valueKey]: point.value }) as { ts: number } & Record<TKey, number>
    )

    const payload: CatapultSeriesPayload<TKey> = { points }
    return encodeJsonPayload(payload)
  }

  private async upsertPeriodHeartRateSeries(periodId: string, dataEncoded: string) {
    const trx = await db.transaction()
    try {
      const existing = await Serie.query({ client: trx })
        .where('periodId', periodId)
        .where('type', SERIE_TYPE.HEART_RATE)
        .first()

      const serieData = {
        periodId,
        type: SERIE_TYPE.HEART_RATE,
        dataEncoded,
        dataType: DATA_TYPE.UNSIGNED,
      }

      if (existing) {
        existing.merge({
          dataEncoded: serieData.dataEncoded,
          dataType: serieData.dataType,
        })
        existing.useTransaction(trx)
        await existing.save()
      } else {
        await Serie.create(serieData, { client: trx })
      }

      await trx.commit()
    } catch (error) {
      await trx.rollback()
      throw error
    }
  }

  public async processHeartRate(
    periodId: string,
    catapultPeriodId: string,
    catapultAthleteId: string
  ) {
    try {
      const sensorResponse = await this.getPeriodSensorData(
        catapultPeriodId,
        catapultAthleteId,
        'ts,hr',
        1
      )

      const sensorData = sensorResponse[0]?.data ?? []
      const encodedHeartRateSeries = this.encodeTimestampedSeriesFromSensorData(sensorData, 'hr')
      if (!encodedHeartRateSeries) return null
      await this.upsertPeriodHeartRateSeries(periodId, encodedHeartRateSeries)
      return encodedHeartRateSeries
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        return 'not_found'
      }

      console.error(
        `[CatapultService] Failed to fetch/store sensor data for period ${catapultPeriodId}:`,
        error
      )
      throw error
    }
  }

  public groupPeriodsByAthlete(
    catapultData: Array<CatapultApiResponse>
  ): Map<string, Array<CatapultApiResponse>> {
    const periodsByAthlete = new Map<string, Array<CatapultApiResponse>>()
    const sortedCatapultData = catapultData.sort((a, b) => a.start_time - b.start_time)
    for (const data of sortedCatapultData) {
      const athleteId = data.athlete_id
      if (data.is_demo_data) continue
      if (!periodsByAthlete.has(athleteId)) {
        periodsByAthlete.set(athleteId, [])
      }
      periodsByAthlete.get(athleteId)!.push(data)
    }
    return periodsByAthlete
  }

  public groupPeriodsByAthleteAndActivity(
    catapultData: Array<CatapultApiResponse>
  ): Map<string, { athleteId: string; activityId: string; periods: Array<CatapultApiResponse> }> {
    const periodsByAthleteAndActivity = new Map<
      string,
      { athleteId: string; activityId: string; periods: Array<CatapultApiResponse> }
    >()
    const sortedCatapultData = catapultData.sort((a, b) => a.start_time - b.start_time)
    for (const data of sortedCatapultData) {
      if (data.is_demo_data) continue
      const athleteId = data.athlete_id
      const activityId = data.activity_id
      const key = `${athleteId}|${activityId}`
      if (!periodsByAthleteAndActivity.has(key)) {
        periodsByAthleteAndActivity.set(key, {
          athleteId,
          activityId,
          periods: [],
        })
      }
      periodsByAthleteAndActivity.get(key)!.periods.push(data)
    }
    return periodsByAthleteAndActivity
  }

  public async processPlayerPeriods(
    athleteId: string,
    activityName: string,
    periods: Array<CatapultApiResponse>
  ) {
    if (periods.length === 0) return null

    const trx = await db.transaction()

    try {
      const athlete = await Athlete.query()
        .whereHas('athleteProviders', (query) => {
          query
            .where('provider', ATHLETE_PROVIDER_TYPES.CATAPULT)
            .where('providerAthleteId', athleteId)
        })
        .preload('injuries')
        .first()
      if (!athlete) {
        throw new Error(
          this.clubId !== undefined
            ? `Athlete not found for catapultId ${athleteId} in club ${this.clubId}`
            : `Athlete not found for catapultId ${athleteId}`
        )
      }
      const day = await this.athleteService.getOrCreateDay(
        athlete.id,
        DateTime.fromFormat(periods[0].date, 'dd/MM/yyyy')
      )

      const isGame = periods.some((period) => period.period_name.toLowerCase().includes('half'))

      let sportActivity = await SportActivity.query({ client: trx })
        .where('dayId', day.id)
        .where('timeOfActivity', periods[0].start_time_h)
        .first()

      if (!sportActivity) {
        const existingPeriods = await Period.query({ client: trx })
          .whereIn(
            'providerId',
            periods.map((p) => p.period_id)
          )
          .whereHas('sportActivity', (query) => {
            query.where('dayId', day.id)
          })
          .select('sportActivityId')
          .groupBy('sportActivityId')
          .limit(1)

        if (existingPeriods.length > 0) {
          sportActivity = await SportActivity.query({ client: trx })
            .where('id', existingPeriods[0].sportActivityId)
            .where('dayId', day.id)
            .first()
        }
      }

      if (sportActivity) {
        await trx.rollback()
        const existingActivity = await SportActivity.query()
          .where('id', sportActivity.id)
          .preload('day', (q) => q.preload('athlete'))
          .first()
        if (existingActivity?.day?.athlete && !existingActivity.eventId) {
          await this.eventService.syncCatapultActivityToCalendar(existingActivity, {
            startTime: DateTime.fromSeconds(periods[0].start_time),
            endTime: DateTime.fromSeconds(periods[periods.length - 1].end_time),
          })
        }
        return null
      }

      sportActivity = await SportActivity.create(
        {
          activityName: activityName,
          dayId: day.id,
          activityTypeId: await getFootballActivityTypeId(),
          timeOfActivity: periods[0].start_time_h,
          durationSeconds: Math.round(
            DateTime.fromSeconds(periods[periods.length - 1].end_time)
              .diff(DateTime.fromSeconds(periods[0].start_time))
              .as('seconds')
          ),
          dataSource: 'catapult',
          gameActivity: isGame,
        },
        { client: trx }
      )

      const metrics = await PeriodMetric.query().whereIn('name', [...CATAPULT_METRICS])

      const existingPeriods = await Period.query({ client: trx })
        .where('sportActivityId', sportActivity.id)
        .whereIn(
          'providerId',
          periods.map((p) => p.period_id)
        )

      const createdPeriods = await Promise.all(
        periods.map(async (period) => {
          const existingPeriod = existingPeriods.find((p) => p.providerId === period.period_id)

          if (existingPeriod) {
            return existingPeriod
          }

          return Period.create(
            {
              sportActivityId: sportActivity.id,
              providerId: period.period_id,
              name: period.period_name,
              startTime: DateTime.fromSeconds(period.start_time),
              endTime: DateTime.fromSeconds(period.end_time),
            },
            { client: trx }
          )
        })
      )

      const allPeriodMetrics = periods.map((period, i) => ({
        metrics: this.extractMetricsFromPeriod(period),
        period: createdPeriods[i],
      }))

      const existingMetricValues = await PeriodMetricValue.query({ client: trx })
        .whereIn(
          'periodId',
          createdPeriods.map((p) => p.id)
        )
        .whereIn(
          'metricId',
          metrics.map((m) => m.id)
        )

      await Promise.all(
        allPeriodMetrics.flatMap(({ metrics: periodMetrics, period }) =>
          periodMetrics.map(async (metricData) => {
            const metric = metrics.find((m) => m.name === metricData.name)
            if (!metric) {
              console.error(`Metric ${metricData.name} not found - skipping`)
              return
            }

            const existingMetricValue = existingMetricValues.find(
              (v) => v.periodId === period.id && v.metricId === metric.id
            )

            if (existingMetricValue) {
              existingMetricValue.value = metricData.value
              return existingMetricValue.save()
            }

            return PeriodMetricValue.create(
              {
                periodId: period.id,
                metricId: metric.id,
                value: metricData.value,
              },
              { client: trx }
            )
          })
        )
      )

      await trx.commit()

      await Promise.all(
        periods.map(async (catapultPeriod, index) => {
          const createdPeriod = createdPeriods[index]
          if (!createdPeriod) return
          try {
            await this.processHeartRate(
              createdPeriod.id,
              catapultPeriod.period_id,
              catapultPeriod.athlete_id
            )
          } catch (error) {
            console.error(
              `[CatapultService] Process for heart rate failed for period ${catapultPeriod.period_id}:`,
              error
            )
          }
        })
      )

      const finalSportActivity = await SportActivity.query()
        .where('id', sportActivity.id)
        .preload('periods', (periodsQuery) => {
          periodsQuery.preload('metricValues', (metricValuesQuery) => {
            metricValuesQuery.preload('metric')
          })
        })
        .first()

      if (finalSportActivity) {
        await this.eventService.syncCatapultActivityToCalendar(finalSportActivity, {
          startTime: DateTime.fromSeconds(periods[0].start_time),
          endTime: DateTime.fromSeconds(periods[periods.length - 1].end_time),
        })
      }

      return finalSportActivity
    } catch (error) {
      await trx.rollback()
      throw error
    }
  }

  public extractMetricsFromPeriod(
    period: CatapultApiResponse
  ): Array<{ name: string; value: string }> {
    const metrics = Object.entries(period)
      .filter(([key]) => CATAPULT_METRICS.includes(key as CatapultMetric))
      .map(
        ([key, value]) =>
          value !== null && {
            name: key,
            value: value.toString(),
          }
      )
      .filter((metric): metric is { name: string; value: string } => metric !== null)
    return metrics
  }

  public async getDatasForImputation(periods: Array<Period>) {
    if (periods.length === 0) {
      return {}
    }

    const result: Record<
      keyof CatapultImputationPayload,
      Array<string | number | boolean | null>
    > = {
      ...CATAPULT_METRICS_TO_IMPUTE.reduce(
        (acc, metric) => {
          acc[metric] = []
          return acc
        },
        {} as Record<keyof CatapultImputationPayload, Array<string | number | null>>
      ),
      first_name: [],
      last_name: [],
      season: [],
      name: [],
      player_position: [],
      date_of_day: [],
      time_of_activity: [],
      activity_name: [],
    }

    for (const period of periods) {
      const averageGnssQuality = period.metricValues.find(
        (m) => m.metric?.name === 'average_gnss_quality'
      )?.value
      if (averageGnssQuality && Number(averageGnssQuality) > 50) {
        continue
      }
      const athlete = period.sportActivity.day.athlete
      const day = period.sportActivity.day
      const sportActivity = period.sportActivity

      result['first_name'].push(athlete.firstName)
      result['last_name'].push(athlete.lastName)
      result['name'].push(period.name || null)
      result['player_position'].push(athlete.playerPosition?.name || null)
      result['date_of_day'].push(day.dateOfDay ? day.dateOfDay.toFormat('yyyy-MM-dd') : null)
      result['time_of_activity'].push(sportActivity.timeOfActivity?.slice(0, 8) ?? null)
      result['activity_name'].push(sportActivity.activityName || null)

      let seasonName: string | null = null
      if (day.dateOfDay && athlete.club?.seasons) {
        const dateOfDay = day.dateOfDay
        const dateOfDayJs = dateOfDay.toJSDate()
        const season = athlete.club.seasons.find(
          (s) => dateOfDayJs >= s.startDate && dateOfDayJs <= s.endDate
        )
        seasonName = season?.name || null
      }
      result['season'].push(seasonName)

      const metricMap = new Map<string, ReturnType<typeof this.metricService.getTypedValue>>()
      period.metricValues.forEach((metricValue) => {
        if (metricValue.metric) {
          metricMap.set(
            metricValue.metric.name,
            this.metricService.getTypedValue(metricValue.value, metricValue.metric.dataType)
          )
        }
      })

      CATAPULT_METRICS_TO_IMPUTE.forEach((metric) => {
        const value = metricMap.get(metric)
        if (value !== undefined) {
          result[metric].push(value)
        } else {
          result[metric].push(null)
        }
      })
    }

    return result
  }

  public async processImputation(periodIds: Array<string>) {
    const periods = await Period.query()
      .whereIn('id', periodIds)
      .preload('sportActivity', (sportActivityQuery) => {
        sportActivityQuery.preload('day', (dayQuery) => {
          dayQuery.preload('athlete', (athleteQuery) => {
            athleteQuery.preload('playerPosition')
            athleteQuery.preload('club', (clubQuery) => {
              clubQuery.preload('seasons', (seasonsQuery) => {
                seasonsQuery.orderBy('startDate', 'desc')
              })
            })
          })
        })
      })
      .preload('metricValues', (metricValuesQuery) => {
        metricValuesQuery.preload('metric', (metricQuery) => {
          metricQuery.whereIn('name', CATAPULT_METRICS_TO_IMPUTE)
        })
      })

    const periodsToImpute = periods.filter((period) => {
      const averageGnssQuality = period.metricValues.find(
        (m) => m.metric?.name === 'average_gnss_quality'
      )?.value
      if (averageGnssQuality && Number(averageGnssQuality) > 50) {
        return false
      }
      return true
    })

    const datas = await this.getDatasForImputation(periodsToImpute)
    const response = await axios.post<CatapultImputationResponse>(`${this.imputationUrl}`, datas, {
      headers: {
        'Authorization': `Bearer ${env.get('MACHINE_LEARNING_API_TOKEN')}`,
        'Content-Type': 'application/json',
      },
    })

    const trx = await db.transaction()
    try {
      await Promise.all(
        periodsToImpute.map(async (period, index) => {
          if (index >= response.data.result.length) {
            return
          }

          const imputedData = response.data.result[index]
          const metricsToUpdate: Record<string, string | number> = {}

          CATAPULT_METRICS_TO_IMPUTE.forEach((metric) => {
            const value = imputedData[metric]
            if (value !== null && value !== undefined) {
              metricsToUpdate[metric] = value
            }
          })

          if (Object.keys(metricsToUpdate).length > 0) {
            await this.metricService.updateMetrics(period.id, metricsToUpdate, trx)
          }
        })
      )

      await trx.commit()
    } catch (error) {
      await trx.rollback()
      throw error
    }

    return {
      payload: datas,
      imputation: response.data,
    }
  }
}
