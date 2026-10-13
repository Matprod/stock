import { DateTime } from 'luxon'
import axios from 'axios'
import env from '#start/env'
import Period from '#models_pg/period'
import Day from '#models_pg/day'
import Athlete from '#models_pg/athlete'
import HealthRating from '#models_pg/health_rating'
import Sleep from '#models_pg/sleep'
import BodymetricsHistory from '#models_pg/bodymetrics_history'
import { CATAPULT_METRICS } from '#constants/catapult.constants'
import { MetricService } from '#services/metric_service'
import { MetricDomain } from '#contracts/metric'
import type {
  SunderlandImputationPayload,
  SunderlandImputationResponse,
  SunderlandDailyRow,
} from '#contracts/sunderland'
import db from '@adonisjs/lucid/services/db'

export default class SunderlandService {
  private metricService: MetricService
  private readonly endpointUrl = env.get('MACHINE_LEARNING_TMA_IMPUTATION_URL')

  constructor() {
    this.metricService = new MetricService(MetricDomain.PERIOD)
  }

  public async processAndImpute(
    athleteIds: string[],
    startDate: DateTime,
    endDate: DateTime
  ): Promise<SunderlandImputationResponse> {
    const periods = await this.fetchCatapultPeriods(athleteIds, startDate, endDate)
    const tmaData = await this.fetchTMAData(athleteIds, startDate, endDate)
    const dailyCatapult = this.buildDailyCatapultTable(periods)
    const mergedData = this.mergeWithTMA(dailyCatapult, tmaData)
    const dataWithLags = this.addLag1Features(mergedData)
    const payload = this.convertToColumnarFormat(dataWithLags)
    let response = await this.sendToEndpoint(payload)
    if (typeof response === 'string') {
      response = JSON.parse(
        (response as any).replace(/NaN/g, 'null')
      ) as SunderlandImputationResponse
    }
    await this.saveSunderlandImputation(response)
    return response
  }

  private async saveSunderlandImputation(response: SunderlandImputationResponse): Promise<void> {
    const trx = await db.transaction()

    // console.log(`response: ${JSON.stringify(response)}`)
    try {
      const parsedResults = response.result
        .map((result) => {
          const nameParts = result.username_lastname.trim().split(/\s+/)
          if (nameParts.length < 2) {
            console.warn(`Invalid name format: ${result.username_lastname}`)
            return null
          }

          const firstName = nameParts[0]
          const lastName = nameParts.slice(1).join(' ')
          const dateOfDay = DateTime.fromFormat(result.date_of_day, 'yyyy-MM-dd')

          if (!dateOfDay.isValid) {
            console.warn(`Invalid date format: ${result.date_of_day}`)
            return null
          }

          return {
            result,
            firstName,
            lastName,
            dateOfDay,
          }
        })
        .filter((item): item is NonNullable<typeof item> => item !== null)

      if (parsedResults.length === 0) {
        await trx.commit()
        return
      }

      const uniqueNames = new Map<string, { firstName: string; lastName: string }>()
      for (const parsed of parsedResults) {
        const key = `${parsed.firstName}_${parsed.lastName}`
        if (!uniqueNames.has(key)) {
          uniqueNames.set(key, { firstName: parsed.firstName, lastName: parsed.lastName })
        }
      }

      const namePairs = Array.from(uniqueNames.values())
      const athletes = await Athlete.query({ client: trx }).where((builder) => {
        for (let i = 0; i < namePairs.length; i++) {
          const pair = namePairs[i]
          if (i === 0) {
            builder.where('firstName', pair.firstName).where('lastName', pair.lastName)
          } else {
            builder.orWhere((subBuilder) => {
              subBuilder.where('firstName', pair.firstName).where('lastName', pair.lastName)
            })
          }
        }
      })

      const athleteMap = new Map<string, Athlete>()
      for (const athlete of athletes) {
        const key = `${athlete.firstName}_${athlete.lastName}`
        athleteMap.set(key, athlete)
      }

      const validResults = parsedResults.filter((parsed) => {
        const key = `${parsed.firstName}_${parsed.lastName}`
        if (!athleteMap.has(key)) {
          console.warn(`Athlete not found: ${parsed.result.username_lastname}`)
          return false
        }
        return true
      })

      if (validResults.length === 0) {
        await trx.commit()
        return
      }

      const athleteIds = Array.from(
        new Set(validResults.map((r) => athleteMap.get(`${r.firstName}_${r.lastName}`)!.id))
      )
      const dates = validResults.map((r) => r.dateOfDay)
      const dateRange = {
        min: DateTime.min(...dates),
        max: DateTime.max(...dates),
      }

      if (!dateRange.min || !dateRange.max) {
        await trx.commit()
        return
      }

      const existingDays = await Day.query({ client: trx })
        .whereIn('athleteId', athleteIds)
        .whereBetween('dateOfDay', [dateRange.min.toJSDate(), dateRange.max.toJSDate()])

      const dayMap = new Map<string, Day>()
      for (const day of existingDays) {
        if (day.dateOfDay) {
          const key = `${day.athleteId}_${day.dateOfDay.toFormat('yyyy-MM-dd')}`
          dayMap.set(key, day)
        }
      }

      const existingDayIds = Array.from(dayMap.values()).map((d) => d.id)
      const existingHealth =
        existingDayIds.length > 0
          ? await HealthRating.query({ client: trx }).whereIn('dayId', existingDayIds)
          : []

      const healthMap = new Map<string, HealthRating>()
      for (const health of existingHealth) {
        healthMap.set(health.dayId, health)
      }

      const existingSleep =
        existingDayIds.length > 0
          ? await Sleep.query({ client: trx }).whereIn('dayId', existingDayIds)
          : []

      const sleepMap = new Map<string, Sleep>()
      for (const sleep of existingSleep) {
        sleepMap.set(sleep.dayId, sleep)
      }

      const existingBodymetrics =
        existingDayIds.length > 0
          ? await BodymetricsHistory.query({ client: trx })
              .whereIn('athleteId', athleteIds)
              .whereIn('dayId', existingDayIds)
          : []

      const bodymetricsMap = new Map<string, BodymetricsHistory>()
      for (const bodymetrics of existingBodymetrics) {
        const key = `${bodymetrics.athleteId}_${bodymetrics.dayId}`
        bodymetricsMap.set(key, bodymetrics)
      }

      const healthToCreate: Array<Partial<HealthRating> & { dayId: string }> = []
      const healthToUpdate: Array<{ health: HealthRating; data: Partial<HealthRating> }> = []
      const sleepToCreate: Array<Partial<Sleep> & { dayId: string }> = []
      const sleepToUpdate: Array<{ sleep: Sleep; data: Partial<Sleep> }> = []
      const bodymetricsToCreate: Array<{ athleteId: string; dayId: string; weight: number }> = []
      const bodymetricsToUpdate: Array<{ bodymetrics: BodymetricsHistory; weight: number }> = []

      for (const parsed of validResults) {
        const athlete = athleteMap.get(`${parsed.firstName}_${parsed.lastName}`)!
        const dayKey = `${athlete.id}_${parsed.dateOfDay.toFormat('yyyy-MM-dd')}`
        const day = dayMap.get(dayKey)

        if (!day) {
          continue
        }

        const result = parsed.result
        const hasValidBodyWeight =
          result['Body Weight'] !== null &&
          result['Body Weight'] !== undefined &&
          !isNaN(result['Body Weight'] as number)

        if (
          (result.Energy !== null && result.Energy !== undefined) ||
          (result['Body Soreness'] !== null && result['Body Soreness'] !== undefined) ||
          hasValidBodyWeight
        ) {
          const health = healthMap.get(day.id)
          const healthData: Partial<HealthRating> = {}

          if (result.Energy !== null && result.Energy !== undefined) {
            healthData.energyRating = result.Energy
          }

          if (result['Body Soreness'] !== null && result['Body Soreness'] !== undefined) {
            healthData.bodySorenessRating = result['Body Soreness']
          }

          if (health) {
            healthToUpdate.push({ health, data: healthData })
          } else {
            healthToCreate.push({
              dayId: day.id,
              ...healthData,
            })
          }

          if (hasValidBodyWeight) {
            const bodymetricsKey = `${athlete.id}_${day.id}`
            const bodymetrics = bodymetricsMap.get(bodymetricsKey)

            if (bodymetrics) {
              bodymetricsToUpdate.push({
                bodymetrics,
                weight: result['Body Weight'] as number,
              })
            } else {
              bodymetricsToCreate.push({
                athleteId: athlete.id,
                dayId: day.id,
                weight: result['Body Weight'] as number,
              })
            }
          }
        }

        if (result['Sleep quality'] !== null && result['Sleep quality'] !== undefined) {
          const sleep = sleepMap.get(day.id)
          const sleepData: Partial<Sleep> = {
            qualityRating: result['Sleep quality'],
          }

          if (sleep) {
            sleepToUpdate.push({ sleep, data: sleepData })
          } else {
            sleepToCreate.push({
              dayId: day.id,
              ...sleepData,
            })
          }
        }
      }

      if (healthToCreate.length > 0) {
        await HealthRating.createMany(healthToCreate, { client: trx })
      }

      for (const { health, data } of healthToUpdate) {
        await health.merge(data).useTransaction(trx).save()
      }

      if (sleepToCreate.length > 0) {
        await Sleep.createMany(sleepToCreate, { client: trx })
      }

      for (const { sleep, data } of sleepToUpdate) {
        await sleep.merge(data).useTransaction(trx).save()
      }

      if (bodymetricsToCreate.length > 0) {
        await BodymetricsHistory.createMany(bodymetricsToCreate, { client: trx })
      }

      for (const { bodymetrics, weight } of bodymetricsToUpdate) {
        bodymetrics.weight = weight
        await bodymetrics.useTransaction(trx).save()
      }

      await trx.commit()
    } catch (error) {
      await trx.rollback()
      console.error('Error saving Sunderland imputation:', error)
      throw error
    }
  }

  private getSeasonForDate(athlete: Athlete, date: DateTime): string | null {
    if (!athlete.club?.seasons || !date) {
      return null
    }

    const season = athlete.club.seasons.find(
      (s) => date.toJSDate() >= s.startDate && date.toJSDate() <= s.endDate
    )

    return season?.name || null
  }

  private async fetchCatapultPeriods(
    athleteIds: string[],
    startDate: DateTime,
    endDate: DateTime
  ): Promise<Period[]> {
    return Period.query()
      .whereHas('sportActivity', (query) => {
        query.whereHas('day', (query) => {
          query
            .whereIn('athleteId', athleteIds)
            .whereBetween('dateOfDay', [startDate.toJSDate(), endDate.toJSDate()])
        })
      })
      .preload('sportActivity', (sportActivityQuery) => {
        sportActivityQuery.preload('day', (dayQuery) => {
          dayQuery.preload('athlete', (athleteQuery) => {
            athleteQuery.preload('club', (clubQuery) => {
              clubQuery.preload('seasons', (seasonsQuery) => {
                seasonsQuery.orderBy('startDate', 'desc')
              })
            })
            athleteQuery.preload('playerPosition')
          })
        })
      })
      .preload('metricValues', (metricValuesQuery) => {
        metricValuesQuery.preload('metric')
      })
      .orderBy('createdAt', 'asc')
  }

  private async fetchTMAData(
    athleteIds: string[],
    startDate: DateTime,
    endDate: DateTime
  ): Promise<Map<string, { health?: HealthRating; sleep?: Sleep; bodyWeight?: number }>> {
    const days = await Day.query()
      .whereIn('athleteId', athleteIds)
      .whereBetween('dateOfDay', [startDate.toJSDate(), endDate.toJSDate()])
      .preload('health')
      .preload('sleeps')
      .preload('bodymetricsHistories')
      .preload('athlete')

    const tmaMap = new Map<string, { health?: HealthRating; sleep?: Sleep; bodyWeight?: number }>()

    for (const day of days) {
      if (!day.dateOfDay || !day.athlete) continue

      const athlete = day.athlete
      const name = athlete.name.replace(/\s+/g, ' ').trim()
      const dateKey = `${name}_${day.dateOfDay.toFormat('yyyy-MM-dd')}`

      const health = day.health || undefined
      const sleep = day.sleeps.length > 0 ? day.sleeps[0] : undefined
      let bodyWeight =
        day.bodymetricsHistories.length > 0 ? day.bodymetricsHistories[0].weight : undefined
      if (!bodyWeight && athlete.weightKg) {
        bodyWeight = athlete.weightKg
      }

      tmaMap.set(dateKey, {
        health: health || undefined,
        sleep: sleep,
        bodyWeight: bodyWeight ?? undefined,
      })
    }

    return tmaMap
  }

  private buildDailyCatapultTable(periods: Period[]): Map<string, SunderlandDailyRow> {
    const dailyMap = new Map<string, SunderlandDailyRow>()

    for (const period of periods) {
      const sportActivity = period.sportActivity
      const day = sportActivity.day
      const athlete = day.athlete

      if (!day.dateOfDay || !athlete) continue

      const name = athlete.name.replace(/\s+/g, ' ').trim()
      const dateOfDay = day.dateOfDay.toFormat('yyyy-MM-dd')
      const season = this.getSeasonForDate(athlete, day.dateOfDay)
      const key = `${name}_${dateOfDay}_${season || 'no_season'}`

      if (!dailyMap.has(key)) {
        dailyMap.set(key, {
          'username_lastname': name,
          'date_of_day': dateOfDay,
          'season': season,
          'birth_date': athlete.birthDate?.toFormat('yyyy-MM-dd') || null,
          'weight': athlete.weightKg,
          'height': athlete.heightCm,
          'activityNames': [],
          'periodProviderIds': [],
          'Number_of_activities': 0,
          'Number_of_periods': 0,
          'Number_of_games': 0,
          'total_duration': null,
          'duration': null,
          'Energy': null,
          'Sleep quality': null,
          'Body Soreness': null,
          'Body Weight': null,
          'Sleep hours': null,
        })
      }

      const daily = dailyMap.get(key)!

      if (period.providerId && daily.periodProviderIds.includes(period.providerId)) {
        continue
      }
      if (period.providerId && !daily.periodProviderIds.includes(period.providerId)) {
        daily.periodProviderIds.push(period.providerId)
      }

      if (sportActivity.activityName && !daily.activityNames.includes(sportActivity.activityName)) {
        daily.activityNames.push(sportActivity.activityName)
      }

      if (sportActivity.gameActivity) {
        daily.Number_of_games++
      }

      const metricMap = this.metricService.extractNumericMetrics(period)

      for (const metricName of CATAPULT_METRICS) {
        const value = metricMap.get(metricName)
        if (value === undefined || isNaN(value)) continue

        if (daily[metricName] === undefined || daily[metricName] === null) {
          daily[metricName] = 0
        }

        if (metricName === 'rhie_min_bout_recovery') {
          daily[metricName] =
            typeof daily[metricName] === 'number' ? Math.min(daily[metricName], value) : value
        } else if (metricName.includes('rhie')) {
          daily[metricName] =
            typeof daily[metricName] === 'number' ? daily[metricName] + value : value
        } else if (
          metricName.includes('max') ||
          metricName === 'max_heart_rate' ||
          metricName === 'max_vel' ||
          metricName === 'peak_meta_power'
        ) {
          daily[metricName] =
            typeof daily[metricName] === 'number' ? Math.max(daily[metricName], value) : value
        } else if (metricName === 'mean_heart_rate') {
          if (!daily['_mean_hr_sum']) daily['_mean_hr_sum'] = 0
          if (!daily['_total_duration_sum']) daily['_total_duration_sum'] = 0
          const periodDuration = metricMap.get('total_duration') || 0
          if (periodDuration > 0 && value > 0) {
            daily['_mean_hr_sum'] =
              typeof daily['_mean_hr_sum'] === 'number'
                ? daily['_mean_hr_sum'] + value * periodDuration
                : value * periodDuration
            daily['_total_duration_sum'] =
              typeof daily['_total_duration_sum'] === 'number'
                ? daily['_total_duration_sum'] + periodDuration
                : periodDuration
          }
        } else if (metricName.includes('rhie') || metricName === 'total_duration') {
          daily[metricName] =
            typeof daily[metricName] === 'number' ? daily[metricName] + value : value
        } else {
          daily[metricName] =
            typeof daily[metricName] === 'number' ? daily[metricName] + value : value
        }
      }
    }

    for (const daily of dailyMap.values()) {
      daily.Number_of_activities = new Set(daily.activityNames).size
      daily.Number_of_periods = daily.periodProviderIds.length

      const totalDurationSum = daily['_total_duration_sum']
      if (typeof totalDurationSum === 'number' && totalDurationSum > 0) {
        const meanHrSum = daily['_mean_hr_sum']
        if (typeof meanHrSum === 'number' && meanHrSum > 0) {
          daily.mean_heart_rate = meanHrSum / totalDurationSum
        } else {
          daily.mean_heart_rate = null
        }
      } else {
        daily.mean_heart_rate = null
      }
      delete daily['_mean_hr_sum']
      delete daily['_total_duration_sum']

      daily.duration = daily.total_duration
    }

    return dailyMap
  }

  private mergeWithTMA(
    dailyCatapult: Map<string, SunderlandDailyRow>,
    tmaData: Map<string, { health?: HealthRating; sleep?: Sleep; bodyWeight?: number }>
  ): SunderlandDailyRow[] {
    const merged: SunderlandDailyRow[] = []

    for (const daily of dailyCatapult.values()) {
      const dateKey = `${daily.username_lastname}_${daily.date_of_day}`
      const tma = tmaData.get(dateKey)

      if (tma) {
        daily.Energy = tma.health?.energyRating || null
        daily['Sleep quality'] = tma.sleep?.qualityRating || null
        daily['Body Soreness'] = tma.health?.bodySorenessRating || null
        daily['Body Weight'] = tma.bodyWeight || null
        daily['Sleep hours'] = tma.sleep?.durationHours || null
      }

      merged.push(daily)
    }

    const seen = new Set<string>()
    return merged.filter((row) => {
      const key = `${row.username_lastname}_${row.date_of_day}`
      if (seen.has(key)) {
        return false
      }
      seen.add(key)
      return true
    })
  }

  private addLag1Features(data: SunderlandDailyRow[]): SunderlandDailyRow[] {
    const sorted = [...data].sort((a, b) => {
      if (a.username_lastname !== b.username_lastname) {
        return a.username_lastname.localeCompare(b.username_lastname)
      }
      return a.date_of_day.localeCompare(b.date_of_day)
    })

    const identityFields = new Set(['username_lastname', 'date_of_day', 'season', 'birth_date'])
    const numericColumns = new Set<string>()

    for (const row of sorted) {
      for (const [key, value] of Object.entries(row)) {
        if (
          !identityFields.has(key) &&
          !key.startsWith('_') &&
          !key.endsWith('_lag1') &&
          !Array.isArray(value) &&
          (typeof value === 'number' || value === null)
        ) {
          numericColumns.add(key)
        }
      }
    }

    let currentAthlete = ''
    const previousValues = new Map<string, number | null>()

    for (const row of sorted) {
      if (row.username_lastname !== currentAthlete) {
        currentAthlete = row.username_lastname
        previousValues.clear()
      }

      for (const col of numericColumns) {
        const lagKey = `${col}_lag1`
        const currentValue = row[col] as number | null | undefined
        const previousValue = previousValues.get(col)

        row[lagKey] = previousValue !== undefined ? previousValue : null

        if (currentValue !== null && currentValue !== undefined) {
          previousValues.set(col, currentValue)
        }
      }
    }

    return sorted
  }

  private convertToColumnarFormat(data: SunderlandDailyRow[]): SunderlandImputationPayload {
    if (data.length === 0) {
      return {}
    }

    const payload: SunderlandImputationPayload = {}

    const columns = new Set<string>()
    for (const row of data) {
      for (const key of Object.keys(row)) {
        columns.add(key)
      }
    }

    for (const col of columns) {
      payload[col] = []
    }

    for (const row of data) {
      for (const col of columns) {
        const value = row[col]
        if (Array.isArray(value)) {
          payload[col].push(value.length > 0 ? value.join(', ') : null)
        } else {
          payload[col].push(value !== undefined ? value : null)
        }
      }
    }

    const lengths = Object.values(payload).map((arr) => arr.length)
    const uniqueLengths = new Set(lengths)
    if (uniqueLengths.size > 1) {
      throw new Error(
        `Columnar format validation failed: arrays have different lengths: ${Array.from(uniqueLengths).join(', ')}`
      )
    }

    return payload
  }

  private async sendToEndpoint(
    payload: SunderlandImputationPayload
  ): Promise<SunderlandImputationResponse> {
    const token = env.get('MACHINE_LEARNING_API_TOKEN')

    try {
      const response = await axios.post<SunderlandImputationResponse>(this.endpointUrl, payload, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      })

      return response.data
    } catch (error) {
      console.error('Error sending to endpoint:', error)
      throw error
    }
  }
}
