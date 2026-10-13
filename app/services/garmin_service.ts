import { DateTime } from 'luxon'
import { GarminActivity, GarminActivitySample, GarminSleep, GpsData } from '#contracts/garmin'
import SportActivity from '#models_pg/sport_activity'
import Day from '#models_pg/day'
import Activity from '#models_pg/activity'
import { GARMIN_SPORT_TO_ACTIVITY } from '#constants/garmin.constants'
import { SportActivityService } from '#services/sport_activity_service'
import AthleteProvider from '#models_pg/athlete_provider'
import { DataSource } from '#contracts/sport_activity'
import AthleteService from '#services/athlete_service'
import logger from '@adonisjs/core/services/logger'
import Serie from '#models_pg/serie'
import { DATA_TYPE, SERIE_TYPE } from '#constants/serie.constants'
import { decodeJsonPayload, savitzkyGolay } from '../utils/statistics.js'
import { InputAttributes } from '#contracts/lucid'
import Period from '#models_pg/period'
import axios from 'axios'
import crypto from 'crypto'
import env from '#start/env'
import ActivityDisplayVariable from '#models_pg/activity_display_variable'
import {
  getActivityVariableUnit,
  resolveActivityDisplayVariables,
} from '../utils/get_activity_variable.js'
import ExerciseLoad from '#models_pg/exercise_load'
import { getMilitaryActivityType } from '../utils/military.js'
import { EventService } from '#services/event_service'
import type { CatapultSeriesPayload } from '#contracts/catapult'
import { buildGarminTimestampSeries, encodeFlatTimestampPairs } from '#utils/series'
import { isNil } from '../utils/boolean.js'
import Sleep from '#models_pg/sleep'
import { MetricDomain } from '#contracts/metric'
import { MetricService } from '#services/metric_service'

import { ATHLETE_PROVIDER_TYPES } from '#constants/athlete_provider.constants'

export class GarminService {
  private sportActivityService: SportActivityService
  private athleteService: AthleteService
  private eventService: EventService
  private periodMetricService = new MetricService(MetricDomain.PERIOD)

  constructor() {
    this.sportActivityService = new SportActivityService()
    this.athleteService = new AthleteService()
    this.eventService = new EventService()
  }

  public async processGarminData(receivedData: GarminActivity[]): Promise<void> {
    const test = await Promise.allSettled(
      receivedData.map(async (activityData) => {
        await this.processGarminActivity(activityData)
      })
    )

    console.log('test:', test)
  }

  public async processGarminActivity(activityData: GarminActivity): Promise<void> {
    const summary = activityData.summary

    const { series, avgPower } = this.processSamples(activityData.samples)

    const activityName = this.getActivityName(summary.activityType, summary.activityName)

    console.log('activityName:', activityName)
    if (!activityName) {
      logger.warn('Unknown Garmin sport: %s (%s)', summary.activityName, summary.activityType)
      return
    }

    const garminProviders = await AthleteProvider.query()
      .where('provider', ATHLETE_PROVIDER_TYPES.GARMIN)
      .where('providerAthleteId', activityData.userId)
      .preload('athlete')

    for (const garminProvider of garminProviders) {
      const activityDate = DateTime.fromSeconds(summary.startTimeInSeconds)
      const day = await this.athleteService.getOrCreateDay(
        String(garminProvider.athlete.id),
        activityDate
      )

      const activity = await Activity.query().where('name', activityName).first()

      if (!activity) {
        logger.warn('Activity not found: %s', activityName)
        continue
      }

      const clubId = garminProvider.athlete.clubId

      const displayVariablesRaw = await ActivityDisplayVariable.query()
        .where('activityId', activity.id)
        .where((query) => {
          query.whereNull('clubId')
          if (clubId) {
            query.orWhere('clubId', clubId)
          }
        })
        .preload('displayVariable')

      const displayVariables = resolveActivityDisplayVariables(displayVariablesRaw, clubId)

      const isDurationVariable = displayVariables.some(
        (dv) => dv.displayVariable.name === 'duration'
      )
      const distanceVariable = getActivityVariableUnit(displayVariables, 'distance')
      const speedVariable = getActivityVariableUnit(displayVariables, 'speed')
      const elevationVariable = getActivityVariableUnit(displayVariables, 'elevation')
      const heartRateVariable = getActivityVariableUnit(displayVariables, 'bpm')
      const cadenceVariable = getActivityVariableUnit(displayVariables, 'cadence')
      const powerVariable = getActivityVariableUnit(displayVariables, 'power')
      const fcMaxVariable = getActivityVariableUnit(displayVariables, 'fcMax')
      const caloriesVariable = getActivityVariableUnit(displayVariables, 'calories')

      const distance =
        summary.distanceInMeters && distanceVariable
          ? this.computeDistance(summary.distanceInMeters, distanceVariable)
          : null

      const speed =
        summary.averageSpeedInMetersPerSecond && speedVariable
          ? this.computeSpeed(summary.averageSpeedInMetersPerSecond, speedVariable)
          : null

      const { elevation, elevationDescent } =
        summary.totalElevationGainInMeters &&
        summary.totalElevationLossInMeters &&
        elevationVariable
          ? this.computeElevation(
              summary.totalElevationGainInMeters,
              summary.totalElevationLossInMeters,
              elevationVariable
            )
          : { elevation: null, elevationDescent: null }

      let averagedBpm: number | null = heartRateVariable
        ? this.nullIfZero(summary.averageHeartRateInBeatsPerMinute)
        : null

      let cadence: number | null =
        summary.averageRunCadenceInStepsPerMinute && cadenceVariable
          ? this.nullIfZero(summary.averageRunCadenceInStepsPerMinute)
          : null

      let activeCalories: number | null = caloriesVariable
        ? this.nullIfZero(summary.activeKilocalories)
        : null
      const deviceName = summary.deviceName

      // const gpsDataForActivity: GpsData[] | null = !(
      //   summary.activityType === 'SWIMMING' || summary.activityType === 'LAP_SWIMMING'
      // )
      //   ? gpsData
      //   : null

      try {
        const createdSportActivity = await this.createSportActivity({
          activity,
          distance: this.nullIfZero(distance),
          speed: this.nullIfZero(speed) as string | number | null,
          durationInSeconds: isDurationVariable ? summary.durationInSeconds : null,
          elevation: this.nullIfZero(elevation),
          elevationDescent: this.nullIfZero(elevationDescent),
          cadence,
          power: powerVariable ? this.nullIfZero(avgPower) : null,
          day,
          timeOfActivity: activityDate,
          averagedBpm,
          fcMax: fcMaxVariable ? this.nullIfZero(summary.maxHeartRateInBeatsPerMinute) : null,
          activeCalories,
          deviceName,
          dataSource: 'garmin',
          series,
          garminActivityId: activityData.activityId,
          // _gpsData: gpsDataForActivity,
          // _fitData: fitData,
        })

        await this.eventService.syncSportActivityToCalendar(createdSportActivity)
      } catch (err) {
        logger.error(
          {
            err,
            athleteId: garminProvider.athlete.id,
            activityName,
            activityDate: activityDate.toISO(),
            summary,
          },
          'Failed to create sport activity'
        )
      }
    }
  }

  public async processGarminSleeps(receivedData: GarminSleep[]): Promise<void> {
    await Promise.allSettled(
      receivedData.map(async (sleepData) => this.processGarminSleep(sleepData))
    )
  }

  public async processGarminSleep(sleepData: GarminSleep): Promise<void> {
    const garminProviders = await AthleteProvider.query()
      .where('provider', ATHLETE_PROVIDER_TYPES.GARMIN)
      .where('providerAthleteId', sleepData.userId)
      .preload('athlete')

    if (garminProviders.length === 0) {
      logger.warn('No athlete mapping found for Garmin user %s', sleepData.userId)
      return
    }

    const offsetSeconds = sleepData.startTimeOffsetInSeconds || 0
    const startUtc = DateTime.fromSeconds(sleepData.startTimeInSeconds, { zone: 'utc' })
    const localBedtime = startUtc.plus({ seconds: offsetSeconds })
    const totalDurationInSeconds =
      sleepData.durationInSeconds + (sleepData.awakeDurationInSeconds || 0)
    const localWakeup = localBedtime.plus({ seconds: totalDurationInSeconds })

    const sleepDay =
      sleepData.calendarDate && DateTime.fromISO(sleepData.calendarDate).isValid
        ? DateTime.fromISO(sleepData.calendarDate)
        : localBedtime

    for (const garminProvider of garminProviders) {
      const day = await this.athleteService.getOrCreateDay(
        String(garminProvider.athlete.id),
        sleepDay
      )

      const existingSleep = await Sleep.query().where('dayId', day.id).first()

      const payload: Partial<Sleep> = {
        bedtimeDate: localBedtime,
        wakeUpDate: localWakeup,
        totalInBedTimeMilli: totalDurationInSeconds * 1000,
        totalAwakeTimeMilli: (sleepData.awakeDurationInSeconds || 0) * 1000,
        totalSlowWaveSleepTimeMilli: (sleepData.deepSleepDurationInSeconds || 0) * 1000,
        totalRemSleepTimeMilli: (sleepData.remSleepInSeconds || 0) * 1000,
        dataSource: 'garmin',
        updatedAt: DateTime.now(),
      }

      if (existingSleep) {
        await existingSleep.merge(payload).save()
      } else {
        await Sleep.create({
          dayId: day.id,
          ...payload,
          createdAt: DateTime.now(),
        })
      }
    }
  }

  private getActivityName(activityType: string, activityName: string): string {
    const militaryActivityType = getMilitaryActivityType(activityName)
    if (militaryActivityType) return militaryActivityType

    const mappedActivityName =
      GARMIN_SPORT_TO_ACTIVITY[activityType as keyof typeof GARMIN_SPORT_TO_ACTIVITY]
    if (mappedActivityName) return mappedActivityName

    return activityName
  }

  private processSamples(samples: GarminActivitySample[]): {
    gpsData: GpsData[]
    series: Array<Omit<InputAttributes<Serie>, 'periodId'>>
    avgPower: number | null
  } {
    const gpsData: GpsData[] = []

    for (const sample of samples) {
      const timestamp = DateTime.fromSeconds(sample.startTimeInSeconds).toISO()

      if (!timestamp) continue

      if (sample.latitudeInDegree && sample.longitudeInDegree) {
        const gpsInfo: GpsData = {
          timestamp,
          latitude: sample.latitudeInDegree,
          longitude: sample.longitudeInDegree,
        }
        gpsData.push(gpsInfo)
      }
    }

    const powerValues = samples
      .map((sample) => sample.powerInWatts)
      .filter((value): value is number => !isNil(value) && Number.isFinite(value))
    const avgPower =
      powerValues.length > 0
        ? powerValues.reduce((acc, curr) => acc + curr, 0) / powerValues.length
        : null

    const {
      elevationInMetersData,
      airTemperatureCelciusData,
      heartRateData,
      speedMetersPerSecondData,
      stepsPerMinuteData,
      totalDistanceInMetersData,
      powerInWattsData,
      bikeCadenceInRPMData,
      swimCadenceInStrokesPerMinuteData,
      wheelChairCadenceInPushesPerMinuteData,
    } = buildGarminTimestampSeries(samples)

    const series: Array<{
      type: InputAttributes<Serie>['type']
      data: number[]
      dataType: InputAttributes<Serie>['dataType']
    }> = []
    const seriesConfigs: Array<{
      type: InputAttributes<Serie>['type']
      data: number[]
      dataType: InputAttributes<Serie>['dataType']
    }> = [
      {
        type: SERIE_TYPE.ELEVATION_IN_METERS,
        data: elevationInMetersData,
        dataType: DATA_TYPE.FLOAT,
      },
      {
        type: SERIE_TYPE.AIR_TEMPERATURE_CELSIUS,
        data: airTemperatureCelciusData,
        dataType: DATA_TYPE.FLOAT,
      },
      { type: SERIE_TYPE.HEART_RATE, data: heartRateData, dataType: DATA_TYPE.UNSIGNED },
      {
        type: SERIE_TYPE.SPEED_METERS_PER_SECOND,
        data: speedMetersPerSecondData,
        dataType: DATA_TYPE.FLOAT,
      },
      {
        type: SERIE_TYPE.STEPS_PER_MINUTE,
        data: stepsPerMinuteData,
        dataType: DATA_TYPE.FLOAT,
      },
      {
        type: SERIE_TYPE.TOTAL_DISTANCE_IN_METERS,
        data: totalDistanceInMetersData,
        dataType: DATA_TYPE.FLOAT,
      },
      {
        type: SERIE_TYPE.POWER_IN_WATTS,
        data: powerInWattsData,
        dataType: DATA_TYPE.FLOAT,
      },
      {
        type: SERIE_TYPE.BIKE_CADENCE_IN_RPM,
        data: bikeCadenceInRPMData,
        dataType: DATA_TYPE.FLOAT,
      },
      {
        type: SERIE_TYPE.SWIM_CADENCE_IN_STROKES_PER_MINUTE,
        data: swimCadenceInStrokesPerMinuteData,
        dataType: DATA_TYPE.FLOAT,
      },
      {
        type: SERIE_TYPE.WHEEL_CHAIR_CADENCE_IN_PUSHES_PER_MINUTE,
        data: wheelChairCadenceInPushesPerMinuteData,
        dataType: DATA_TYPE.FLOAT,
      },
    ]

    seriesConfigs.forEach((config) => {
      if (config.data.length === 0) return
      series.push({
        type: config.type,
        data: config.data,
        dataType: config.dataType,
      })
    })

    return {
      gpsData,
      series: series.map((serie) => ({
        type: serie.type,
        dataEncoded: encodeFlatTimestampPairs(serie.data, serie.type),
        dataType: serie.dataType,
      })),
      avgPower,
    }
  }

  private async createSportActivity({
    garminActivityId,
    activity,
    distance,
    speed,
    durationInSeconds,
    elevation,
    elevationDescent,
    cadence,
    power,
    day,
    timeOfActivity,
    averagedBpm,
    fcMax,
    activeCalories,
    dataSource,
    series,
    // _gpsData,
    // _fitData,
  }: {
    garminActivityId: string
    activity: Activity
    distance: number | null
    speed: string | number | null
    durationInSeconds: number | null
    elevation: number | null
    elevationDescent: number | null
    cadence: number | null
    power: number | null
    day: Day
    timeOfActivity: DateTime
    averagedBpm: number | null
    fcMax: number | null
    activeCalories: number | null
    deviceName: string | null
    dataSource: DataSource
    series: Array<Omit<InputAttributes<Serie>, 'periodId'>>
    // _gpsData: GpsData[] | null
    // _fitData: FitData[]
  }): Promise<SportActivity> {
    // if (_gpsData || _fitData) {
    //   // keep raw tracks available for future storage/processing
    // }

    const roundOrNull = (value: number | null) => (value !== null ? Math.round(value) : null)

    const sportActivity = await SportActivity.create({
      dayId: day.id,
      activityTypeId: activity.id,
      timeOfActivity: timeOfActivity.toFormat('HH:mm:ss'),
      dataSource,
      distance,
      speed: speed ? parseFloat(speed.toString()) : null,
      durationSeconds: durationInSeconds,
      elevation: roundOrNull(elevation),
      elevationDescent: roundOrNull(elevationDescent),
      cadence: roundOrNull(cadence),
      power: roundOrNull(power),
      averagedBpm,
      fcMax,
      activeCalories,
    })

    if (!sportActivity.id) {
      throw new Error('Failed to create sport activity')
    }

    const period = await Period.create({
      providerId: garminActivityId.toString(),
      sportActivityId: sportActivity.id,
      name: 'Garmin Activity',
      startTime: timeOfActivity,
      endTime: timeOfActivity.plus({ seconds: durationInSeconds || 0 }),
    })

    const seriesToCreate: Array<InputAttributes<Serie>> = series.map((serie) => ({
      periodId: period.id,
      ...serie,
    }))

    await Serie.createMany(seriesToCreate)

    const militaryActivityName = activity.name ? getMilitaryActivityType(activity.name) : undefined
    if (militaryActivityName) {
      console.log('Processing military activity: %s', sportActivity.id)
      await this.processMilitaryActivity(sportActivity.id)
    }
    console.log('Calculating training load for sport activity: %s', sportActivity.id)
    await this.sportActivityService.calculateTrainingLoad(sportActivity.id, true)

    return sportActivity
  }

  private computeDistance(distanceInMeters: number | null, unit: string): number | null {
    if (distanceInMeters === null || distanceInMeters === undefined) return null
    if (!isFinite(distanceInMeters) || isNaN(distanceInMeters)) return null
    if (unit === 'km') {
      const km = distanceInMeters / 1000
      const rounded = Math.round(km * 100) / 100
      return isFinite(rounded) && !isNaN(rounded) ? rounded : null
    }
    return distanceInMeters
  }

  private computeSpeed(speedMps: number | null, unit: string): string | number | null {
    if (speedMps === null || speedMps === undefined) return null
    if (!isFinite(speedMps) || isNaN(speedMps) || speedMps <= 0) return null
    if (unit === 'min/km') {
      const secPerKm = 1000 / speedMps
      if (!isFinite(secPerKm) || isNaN(secPerKm)) return null
      const minutes = Math.floor(secPerKm / 60)
      const seconds = Math.floor(secPerKm % 60)
      return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
    }
    if (unit === 'km/h') {
      const kph = Math.round(speedMps * 3.6 * 100) / 100
      return isFinite(kph) && !isNaN(kph) ? kph : null
    }
    if (unit === 'min/100m') {
      const secPer100m = 100 / speedMps
      if (!isFinite(secPer100m) || isNaN(secPer100m)) return null
      const minutes = Math.floor(secPer100m / 60)
      const seconds = Math.floor(secPer100m % 60)
      return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
    }
    return speedMps
  }

  private computeElevation(
    gainMeters: number | null,
    lossMeters: number | null,
    unit: string
  ): { elevation: number | null; elevationDescent: number | null } {
    if (gainMeters === null || gainMeters === undefined)
      return { elevation: null, elevationDescent: null }
    if (!isFinite(gainMeters) || isNaN(gainMeters))
      return { elevation: null, elevationDescent: null }
    let elevation: number | null = gainMeters
    let elevationDescent: number | null = lossMeters
    if (unit === 'km') {
      elevation = elevation / 1000
      if (elevationDescent !== null && elevationDescent !== undefined)
        elevationDescent = elevationDescent / 1000
    }
    if (!isFinite(elevation) || isNaN(elevation)) elevation = null
    if (
      elevationDescent !== null &&
      elevationDescent !== undefined &&
      (!isFinite(elevationDescent) || isNaN(elevationDescent))
    )
      elevationDescent = null
    return { elevation, elevationDescent }
  }

  private nullIfZero<T extends number | string | null | undefined>(value: T): T | null {
    if (typeof value === 'string') return value
    if (value === null || value === undefined) return null
    if (typeof value === 'number') {
      if (!isFinite(value) || isNaN(value) || value === 0) return null
    }
    return value as T
  }

  /**
   * Generate OAuth 1.0a signature for Garmin API
   */
  private generateOAuthSignature(
    method: string,
    url: string,
    params: Record<string, string>,
    oauthParams: Record<string, string>,
    consumerSecret: string,
    accessTokenSecret: string
  ): string {
    // Combine all parameters
    const allParams = { ...params, ...oauthParams }

    // Sort parameters by key
    const sortedKeys = Object.keys(allParams).sort()
    const normalizedParams = sortedKeys
      .map((key) => `${this.percentEncode(key)}=${this.percentEncode(allParams[key])}`)
      .join('&')

    // Create signature base string
    const signatureBaseString = [
      method.toUpperCase(),
      this.percentEncode(url),
      this.percentEncode(normalizedParams),
    ].join('&')

    // Create signing key
    const signingKey = `${this.percentEncode(consumerSecret)}&${this.percentEncode(accessTokenSecret)}`

    // Generate signature
    const signature = crypto
      .createHmac('sha1', signingKey)
      .update(signatureBaseString)
      .digest('base64')

    return signature
  }

  /**
   * Percent encode according to RFC 3986
   */
  private percentEncode(str: string): string {
    return encodeURIComponent(str)
      .replace(/!/g, '%21')
      .replace(/'/g, '%27')
      .replace(/\(/g, '%28')
      .replace(/\)/g, '%29')
      .replace(/\*/g, '%2A')
  }

  /**
   * Generate OAuth 1.0a Authorization header
   */
  private generateOAuthHeader(
    method: string,
    url: string,
    params: Record<string, string>,
    consumerKey: string,
    consumerSecret: string,
    accessToken: string,
    accessTokenSecret: string
  ): string {
    // Generate OAuth parameters (timestamp and nonce must be consistent)
    const oauthParams: Record<string, string> = {
      oauth_consumer_key: consumerKey,
      oauth_token: accessToken,
      oauth_signature_method: 'HMAC-SHA1',
      oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
      oauth_nonce: crypto.randomBytes(16).toString('hex'),
      oauth_version: '1.0',
    }

    // Generate signature using the same oauthParams
    const signature = this.generateOAuthSignature(
      method,
      url,
      params,
      oauthParams,
      consumerSecret,
      accessTokenSecret
    )

    // Add signature to OAuth parameters
    oauthParams.oauth_signature = signature

    // Build Authorization header
    const authHeader =
      'OAuth ' +
      Object.keys(oauthParams)
        .sort()
        .map((key) => `${this.percentEncode(key)}="${this.percentEncode(oauthParams[key])}"`)
        .join(', ')

    return authHeader
  }

  /**
   * Backfill activities from Garmin API
   * @param garminUserId - The Garmin user ID
   * @param summaryStartTimeInSeconds - Start time in seconds (Unix timestamp)
   * @param summaryEndTimeInSeconds - End time in seconds (Unix timestamp)
   */
  public async backfillActivities(
    garminUserId: string,
    summaryStartTimeInSeconds?: number,
    summaryEndTimeInSeconds?: number
  ): Promise<void> {
    try {
      const garminUser = await AthleteProvider.query()
        .where('provider', ATHLETE_PROVIDER_TYPES.GARMIN)
        .where('providerAthleteId', garminUserId)
        .first()

      if (!garminUser) {
        logger.error(`Garmin user not found: ${garminUserId}`)
        return
      }

      if (!garminUser.accessToken) {
        logger.error(`No access token found for Garmin user: ${garminUserId}`)
        return
      }

      if (!garminUser.accessTokenSecret) {
        logger.error(`No access token secret found for Garmin user: ${garminUserId}`)
        return
      }

      const consumerKey = env.get('GARMIN_CONSUMER_KEY')
      const consumerSecret = env.get('GARMIN_CONSUMER_SECRET')

      if (!consumerKey || !consumerSecret) {
        logger.error('Garmin consumer key or secret not configured')
        return
      }

      const baseUrl = 'https://apis.garmin.com/wellness-api/rest/backfill/activityDetails'
      const params: Record<string, string> = {}

      const nowInSeconds = Math.floor(Date.now() / 1000)
      const effectiveStartTimeInSeconds =
        summaryStartTimeInSeconds !== undefined
          ? Math.floor(summaryStartTimeInSeconds)
          : nowInSeconds - 30 * 24 * 60 * 60
      const effectiveEndTimeInSeconds =
        summaryEndTimeInSeconds !== undefined ? Math.floor(summaryEndTimeInSeconds) : nowInSeconds

      params.summaryStartTimeInSeconds = effectiveStartTimeInSeconds.toString()
      params.summaryEndTimeInSeconds = effectiveEndTimeInSeconds.toString()

      const authHeader = this.generateOAuthHeader(
        'GET',
        baseUrl,
        params,
        consumerKey,
        consumerSecret,
        garminUser.accessToken,
        garminUser.accessTokenSecret
      )

      const headers: Record<string, string> = {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
      }

      logger.info('Making backfill request to Garmin API', {
        garminUserId,
        url: baseUrl,
        params,
      })

      const response = await axios.get(baseUrl, {
        params,
        headers,
      })

      logger.info('Garmin backfill response received', {
        status: response.status,
        statusText: response.statusText,
        data: JSON.stringify(response.data, null, 2),
        headers: response.headers,
      })

      console.log('=== Garmin Backfill Response ===')
      console.log('Status:', response.status)
      console.log('Status Text:', response.statusText)
      console.log('Data:', JSON.stringify(response.data, null, 2))
      console.log('Headers:', response.headers)
      console.log('===============================')
    } catch (error) {
      if (axios.isAxiosError(error)) {
        logger.error('Error in Garmin backfill request', {
          garminUserId,
          message: error.message,
          status: error.response?.status,
          statusText: error.response?.statusText,
          data: error.response?.data,
          headers: error.response?.headers,
        })

        console.error('=== Garmin Backfill Error ===')
        console.error('Message:', error.message)
        console.error('Status:', error.response?.status)
        console.error('Status Text:', error.response?.statusText)
        console.error('Response Data:', JSON.stringify(error.response?.data, null, 2))
        console.error('Response Headers:', error.response?.headers)
        console.error('============================')
      } else {
        logger.error('Unexpected error in Garmin backfill', {
          garminUserId,
          error,
        })

        console.error('=== Garmin Backfill Unexpected Error ===')
        console.error(error)
        console.error('========================================')
      }
    }
  }

  /**
   * Backfill sleeps from Garmin API
   * @param garminUserId - The Garmin user ID
   * @param summaryStartTimeInSeconds - Start time in seconds (Unix timestamp)
   * @param summaryEndTimeInSeconds - End time in seconds (Unix timestamp)
   */
  public async backfillSleeps(
    garminUserId: string,
    summaryStartTimeInSeconds?: number,
    summaryEndTimeInSeconds?: number
  ): Promise<void> {
    try {
      const garminProvider = await AthleteProvider.query()
        .where('provider', ATHLETE_PROVIDER_TYPES.GARMIN)
        .where('providerAthleteId', garminUserId)
        .first()

      if (!garminProvider) {
        logger.error(`Garmin user not found: ${garminUserId}`)
        return
      }

      if (!garminProvider.accessToken) {
        logger.error(`No access token found for Garmin user: ${garminUserId}`)
        return
      }

      if (!garminProvider.accessTokenSecret) {
        logger.error(`No access token secret found for Garmin user: ${garminUserId}`)
        return
      }

      const consumerKey = env.get('GARMIN_CONSUMER_KEY')
      const consumerSecret = env.get('GARMIN_CONSUMER_SECRET')

      if (!consumerKey || !consumerSecret) {
        logger.error('Garmin consumer key or secret not configured')
        return
      }

      const baseUrl = 'https://apis.garmin.com/wellness-api/rest/backfill/sleeps'
      const params: Record<string, string> = {}

      const nowInSeconds = Math.floor(Date.now() / 1000)
      const effectiveStartTimeInSeconds =
        summaryStartTimeInSeconds !== undefined
          ? Math.floor(summaryStartTimeInSeconds)
          : nowInSeconds - 30 * 24 * 60 * 60
      const effectiveEndTimeInSeconds =
        summaryEndTimeInSeconds !== undefined ? Math.floor(summaryEndTimeInSeconds) : nowInSeconds

      params.summaryStartTimeInSeconds = effectiveStartTimeInSeconds.toString()
      params.summaryEndTimeInSeconds = effectiveEndTimeInSeconds.toString()

      const authHeader = this.generateOAuthHeader(
        'GET',
        baseUrl,
        params,
        consumerKey,
        consumerSecret,
        garminProvider.accessToken,
        garminProvider.accessTokenSecret
      )

      const headers: Record<string, string> = {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
      }

      logger.info('Making sleep backfill request to Garmin API', {
        garminUserId,
        url: baseUrl,
        params,
      })

      const response = await axios.get(baseUrl, {
        params,
        headers,
      })

      const sleeps: GarminSleep[] = Array.isArray(response.data)
        ? response.data
        : Array.isArray(response.data?.sleeps)
          ? response.data.sleeps
          : []

      if (sleeps.length === 0) {
        logger.info('No sleep data returned by Garmin backfill', {
          garminUserId,
          data: response,
          status: response.status,
        })
        return
      }

      const { default: ProcessGarminSleepJob } = await import('#jobs/process_garmin_sleep_job')
      await ProcessGarminSleepJob.dispatch(sleeps)

      logger.info('Garmin sleep backfill queued successfully', {
        garminUserId,
        count: sleeps.length,
      })
    } catch (error) {
      if (axios.isAxiosError(error)) {
        logger.error('Error in Garmin sleep backfill request', {
          garminUserId,
          message: error.message,
          status: error.response?.status,
          statusText: error.response?.statusText,
          data: error.response?.data,
          headers: error.response?.headers,
        })
      } else {
        logger.error('Unexpected error in Garmin sleep backfill', {
          garminUserId,
          error,
        })
      }
    }
  }

  public async processMilitaryActivity(sportActivityId: string): Promise<void> {
    const sportActivity = await SportActivity.query()
      .where('id', sportActivityId)
      .preload('day', (dayQuery) => {
        dayQuery.preload('athlete')
      })
      .preload('sport')
      .preload('periods', (periodsQuery) => {
        periodsQuery.preload('series')
      })
      .first()

    if (!sportActivity) {
      logger.error('Sport activity not found: %s', sportActivityId)
      return
    }

    const militaryActivityName = getMilitaryActivityType(sportActivity.sport?.name ?? '')

    if (!militaryActivityName) {
      logger.warn('Unknown Garmin military activity: %s', sportActivityId)
      return
    }

    const exerciseLoad = await ExerciseLoad.query()
      .where('athleteId', sportActivity.day.athleteId)
      .if(sportActivity.activityTypeId, (query) => {
        query.where('activityId', sportActivity.activityTypeId!)
      })
      .first()

    const period = sportActivity.periods[0]
    if (
      period &&
      exerciseLoad &&
      exerciseLoad.weaponLoadKg !== null &&
      exerciseLoad.gearLoadKg !== null
    ) {
      await this.periodMetricService.updateMetrics(period.id, {
        weapon_weight: exerciseLoad.weaponLoadKg,
        carried_weight: exerciseLoad.gearLoadKg,
      })
    }

    switch (militaryActivityName) {
      case 'Combat ouvert - configuration légère':
      case 'Combat ouvert - configuration lourde':
      case 'Combat clos - configuration légère':
      case 'Combat clos - configuration lourde':
      case 'Marche avec poids (TAP)':
      case 'Course à pieds avec poids (TAP)':
        await this.processCombatActivity(sportActivity)
        break
      case 'Tir statique - configuration légère':
      case 'Tir statique - configuration lourde':
        await this.processStaticShootingActivity(sportActivity)
        break
      case 'Tir dynamique - configuration légère':
      case 'Tir dynamique - configuration lourde':
        await this.processDynamicShootingActivity(sportActivity)
        break
      default:
        logger.warn('ONEST LA Unknown Garmin military activity: %s', sportActivityId)
        break
    }
  }

  private async processStaticShootingActivity(_sportActivity: SportActivity): Promise<void> {}

  private async processDynamicShootingActivity(_sportActivity: SportActivity): Promise<void> {}

  private async processCombatActivity(sportActivity: SportActivity): Promise<void> {
    const period = sportActivity.periods[0]

    if (!period) {
      logger.error('Period not found: %s', sportActivity.id)
      return
    }

    const series = period.series

    if (!series) {
      logger.error('Series not found: %s', sportActivity.id)
      return
    }

    const speedMetersPerSecondSerie = series.find(
      (s) => s.type === SERIE_TYPE.SPEED_METERS_PER_SECOND
    )

    if (!speedMetersPerSecondSerie) {
      return
    }

    const decodedSpeedPayload = decodeJsonPayload<CatapultSeriesPayload<'speed'>>(
      speedMetersPerSecondSerie.dataEncoded
    )
    const decodedSpeedSerie = decodedSpeedPayload.points
      .map((point) => point.speed)
      .filter((speed) => Number.isFinite(speed))

    const deltaT = 1

    const smoothedSpeed = savitzkyGolay(decodedSpeedSerie, 11, 3)

    const longitudinalAccelerations = []
    for (let i = 1; i < smoothedSpeed.length - 1; i++) {
      const acceleration = (smoothedSpeed[i + 1] - smoothedSpeed[i - 1]) / (2 * deltaT)
      longitudinalAccelerations.push(acceleration)
    }
    let totalAbsAcceleration = 0
    let totalPosAcceleration = 0
    let totalNegAcceleration = 0

    for (const accel of longitudinalAccelerations) {
      totalAbsAcceleration += Math.abs(accel) * deltaT
      if (accel > 0) totalPosAcceleration += accel * deltaT
      else totalNegAcceleration += -accel * deltaT
    }

    // Bursts detection
    const windowSec = 1.5
    const windowSamples = Math.round(windowSec / deltaT)
    const accelThreshold = 1.5
    const decelThreshold = -1.5

    let numAccBursts = 0
    let numDecBursts = 0

    for (let i = windowSamples; i < smoothedSpeed.length - windowSamples; i++) {
      const deltaV = smoothedSpeed[i + windowSamples] - smoothedSpeed[i - windowSamples]
      if (deltaV >= accelThreshold) numAccBursts++
      if (deltaV <= decelThreshold) numDecBursts++
    }

    const numBursts = numAccBursts + numDecBursts

    await this.periodMetricService.updateMetrics(period.id, { burst_count: numBursts })
  }
}
