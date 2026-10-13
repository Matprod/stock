import { DateTime } from 'luxon'
import axios from 'axios'
import env from '#start/env'
import Period from '#models_pg/period'
import Athlete from '#models_pg/athlete'
import Season from '#models_pg/season'
import { MetricService } from '#services/metric_service'
import { MetricDomain } from '#contracts/metric'
import type {
  TrainingLoadFactorsPayload,
  TrainingLoadFactorsResponse,
  TrainingLoadFactorsData,
  TrainingLoadFactorsResult,
} from '#contracts/sunderland'

export default class TrainingLoadFactorsService {
  private metricService: MetricService
  private dayMetricService: MetricService
  private readonly factorsBaseUrl = env.get('MACHINE_LEARNING_TRAINING_LOAD_FACTORS_URL')

  constructor() {
    this.metricService = new MetricService(MetricDomain.PERIOD)
    this.dayMetricService = new MetricService(MetricDomain.DAY)
  }

  private getSeasonForDate(athlete: Athlete, date: DateTime): string | null {
    if (!athlete.club?.seasons || !date) {
      return null
    }

    const season = athlete.club.seasons.find(
      (s: Season) => date.toJSDate() >= s.startDate && date.toJSDate() <= s.endDate
    )

    return season?.name || null
  }

  public async calculateFactors(
    payload: TrainingLoadFactorsPayload
  ): Promise<TrainingLoadFactorsResponse> {
    const token = env.get('MACHINE_LEARNING_API_TOKEN')

    try {
      const response = await axios.post<TrainingLoadFactorsResponse>(this.factorsBaseUrl, payload, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      })

      return response.data
    } catch (error) {
      console.error('Error calculating training load factors:', error)
      throw error
    }
  }

  public async calculateFactorsForDay(
    athleteId: string,
    dateOfDay: DateTime
  ): Promise<TrainingLoadFactorsResponse> {
    const periods = await Period.query()
      .whereHas('sportActivity', (query) => {
        query.whereHas('day', (query) => {
          query.where('athleteId', athleteId).where('dateOfDay', dateOfDay.toJSDate())
        })
      })
      .preload('metricValues', (query) => {
        query.preload('metric')
      })
      .preload('sportActivity', (query) => {
        query.preload('day', (query) => {
          query.preload('athlete', (athleteQuery) => {
            athleteQuery.preload('club', (clubQuery) => {
              clubQuery.preload('seasons', (seasonsQuery) => {
                seasonsQuery.orderBy('startDate', 'desc')
              })
            })
          })
        })
      })

    return this.calculateFactorsForPeriods(periods)
  }

  public async calculateFactorsForDateRange(
    athleteId: string,
    startDate: DateTime,
    endDate: DateTime
  ): Promise<TrainingLoadFactorsResponse> {
    const periods = await Period.query()
      .whereHas('sportActivity', (query) => {
        query.whereHas('day', (query) => {
          query
            .where('athleteId', athleteId)
            .whereBetween('dateOfDay', [startDate.toJSDate(), endDate.toJSDate()])
        })
      })
      .preload('metricValues', (query) => {
        query.preload('metric')
      })
      .preload('sportActivity', (query) => {
        query.preload('day', (query) => {
          query.preload('athlete', (athleteQuery) => {
            athleteQuery.preload('club', (clubQuery) => {
              clubQuery.preload('seasons', (seasonsQuery) => {
                seasonsQuery.orderBy('startDate', 'desc')
              })
            })
          })
        })
      })
      .orderBy('createdAt', 'asc')

    return this.calculateFactorsForPeriods(periods)
  }

  public async calculateFactorsForPeriods(periods: Period[]): Promise<TrainingLoadFactorsResponse> {
    if (periods.length === 0) {
      return { result: [] }
    }

    const dailyMap = new Map<
      string,
      TrainingLoadFactorsData & {
        field_time_sum: number
        fmp_dynamic_sum: number
        fmp_running_sum: number
        dayId: string
      }
    >()

    for (const period of periods) {
      const sportActivity = period.sportActivity
      const day = sportActivity?.day
      const athlete = day?.athlete

      if (!day?.dateOfDay || !athlete || !day.id) {
        continue
      }

      const name = athlete.name.replace(/\s+/g, ' ').trim()
      const dateOfDay = day.dateOfDay.toFormat('yyyy-MM-dd')
      const season = this.getSeasonForDate(athlete, day.dateOfDay)

      if (!season) {
        console.warn(`Skipping period ${period.id} because no season found`)
        continue
      }

      const key = `${name}_${dateOfDay}_${season}`

      const metricMap = this.metricService.extractNumericMetrics(period, [
        'total_distance',
        'gen2_velocity_band1_total_distance',
        'gen2_velocity_band2_total_distance',
        'field_time',
        'total_player_load',
        'total_1d_side_player_load',
        'total_1d_up_player_load',
        'meta_energy_kj',
        'gen2_velocity_band3_total_distance',
        'gen2_velocity_band4_total_distance',
        'gen2_velocity_band5_total_distance',
        'high_metabolic_load_distance',
        'velocity_exertion',
        'peak_meta_power',
        'fmp_dynamic_high_duration',
        'fmp_running_high_duration',
        'ima_band3_accel_count',
        'ima_band3_decel_count',
        'ima_band3_left_count',
        'ima_band3_right_count',
        'total_acceleration_load',
        'gen2_acceleration_band6plus_total_effort_count',
        'rhie_bout_count',
        'rhie_max_effort_duration',
        'rhie_max_effort_count',
      ])

      const requiredMetrics = [
        'total_distance',
        'gen2_velocity_band1_total_distance',
        'gen2_velocity_band2_total_distance',
        'field_time',
        'total_player_load',
        'total_1d_side_player_load',
        'total_1d_up_player_load',
        'meta_energy_kj',
        'gen2_velocity_band3_total_distance',
        'gen2_velocity_band4_total_distance',
        'gen2_velocity_band5_total_distance',
        'high_metabolic_load_distance',
        'velocity_exertion',
        'peak_meta_power',
        'fmp_dynamic_high_duration',
        'fmp_running_high_duration',
        'ima_band3_accel_count',
        'ima_band3_decel_count',
        'ima_band3_left_count',
        'ima_band3_right_count',
        'total_acceleration_load',
        'gen2_acceleration_band6plus_total_effort_count',
        'rhie_bout_count',
        'rhie_max_effort_duration',
        'rhie_max_effort_count',
      ]

      const hasAllRequiredMetrics = requiredMetrics.every((metric) => {
        const value = metricMap.get(metric)
        return value !== undefined && value !== null && !isNaN(value)
      })

      if (!hasAllRequiredMetrics) {
        console.warn(`Skipping period ${period.id} because it is missing required metrics`)
        continue
      }

      if (!dailyMap.has(key)) {
        dailyMap.set(key, {
          username_lastname: name,
          season: season,
          date_of_day: dateOfDay,
          total_distance: 0,
          gen2_velocity_band1_total_distance: 0,
          gen2_velocity_band2_total_distance: 0,
          field_time: 0,
          total_player_load: 0,
          total_1d_side_player_load: 0,
          total_1d_up_player_load: 0,
          meta_energy_kj: 0,
          gen2_velocity_band3_total_distance: 0,
          gen2_velocity_band4_total_distance: 0,
          gen2_velocity_band5_total_distance: 0,
          high_metabolic_load_distance: 0,
          velocity_exertion: 0,
          peak_meta_power: 0,
          fmp_dynamic_high_duration_ratio: 0,
          fmp_running_high_duration_ratio: 0,
          ima_band3_accel_count: 0,
          ima_band3_decel_count: 0,
          ima_band3_left_count: 0,
          ima_band3_right_count: 0,
          total_acceleration_load: 0,
          gen2_acceleration_band6plus_total_effort_count: 0,
          rhie_bout_count: 0,
          rhie_max_effort_duration: 0,
          rhie_max_effort_count: 0,
          field_time_sum: 0,
          fmp_dynamic_sum: 0,
          fmp_running_sum: 0,
          dayId: day.id,
        })
      }

      const daily = dailyMap.get(key)!

      daily.total_distance += metricMap.get('total_distance') || 0
      daily.gen2_velocity_band1_total_distance +=
        metricMap.get('gen2_velocity_band1_total_distance') || 0
      daily.gen2_velocity_band2_total_distance +=
        metricMap.get('gen2_velocity_band2_total_distance') || 0
      daily.field_time += metricMap.get('field_time') || 0
      daily.total_player_load += metricMap.get('total_player_load') || 0
      daily.total_1d_side_player_load += metricMap.get('total_1d_side_player_load') || 0
      daily.total_1d_up_player_load += metricMap.get('total_1d_up_player_load') || 0
      daily.meta_energy_kj += metricMap.get('meta_energy_kj') || 0

      daily.gen2_velocity_band3_total_distance +=
        metricMap.get('gen2_velocity_band3_total_distance') || 0
      daily.gen2_velocity_band4_total_distance +=
        metricMap.get('gen2_velocity_band4_total_distance') || 0
      daily.gen2_velocity_band5_total_distance +=
        metricMap.get('gen2_velocity_band5_total_distance') || 0
      daily.high_metabolic_load_distance += metricMap.get('high_metabolic_load_distance') || 0
      daily.velocity_exertion += metricMap.get('velocity_exertion') || 0
      daily.peak_meta_power = Math.max(daily.peak_meta_power, metricMap.get('peak_meta_power') || 0)

      const fmpDynamicHighDuration = metricMap.get('fmp_dynamic_high_duration') || 0
      const fmpRunningHighDuration = metricMap.get('fmp_running_high_duration') || 0
      daily.field_time_sum += metricMap.get('field_time') || 0

      daily.ima_band3_accel_count += metricMap.get('ima_band3_accel_count') || 0
      daily.ima_band3_decel_count += metricMap.get('ima_band3_decel_count') || 0
      daily.ima_band3_left_count += metricMap.get('ima_band3_left_count') || 0
      daily.ima_band3_right_count += metricMap.get('ima_band3_right_count') || 0
      daily.total_acceleration_load += metricMap.get('total_acceleration_load') || 0
      daily.gen2_acceleration_band6plus_total_effort_count +=
        metricMap.get('gen2_acceleration_band6plus_total_effort_count') || 0
      daily.rhie_bout_count += metricMap.get('rhie_bout_count') || 0
      daily.rhie_max_effort_duration = Math.max(
        daily.rhie_max_effort_duration,
        metricMap.get('rhie_max_effort_duration') || 0
      )
      daily.rhie_max_effort_count += metricMap.get('rhie_max_effort_count') || 0

      daily.fmp_dynamic_sum += fmpDynamicHighDuration
      daily.fmp_running_sum += fmpRunningHighDuration
    }

    const payloadData: TrainingLoadFactorsData[] = []
    const dayIdMap = new Map<number, string>()

    for (const [index, daily] of Array.from(dailyMap.values()).entries()) {
      if (daily.field_time_sum > 0) {
        daily.fmp_dynamic_high_duration_ratio = daily.fmp_dynamic_sum / daily.field_time_sum
        daily.fmp_running_high_duration_ratio = daily.fmp_running_sum / daily.field_time_sum
      } else {
        daily.fmp_dynamic_high_duration_ratio = 0
        daily.fmp_running_high_duration_ratio = 0
      }

      const { field_time_sum, fmp_dynamic_sum, fmp_running_sum, dayId, ...dailyData } = daily

      payloadData.push(dailyData)
      dayIdMap.set(index, dayId)
    }

    if (payloadData.length === 0) {
      return { result: [] }
    }

    const payload: TrainingLoadFactorsPayload = { data: payloadData }
    console.log(payload)
    const response = await this.calculateFactors(payload)

    // Store results in day_metric
    if (response.result && response.result.length > 0) {
      console.log('Storing factors results')
      await this.storeFactorsResults(response.result, dayIdMap)
    } else {
      console.log('No factors results to store')
    }

    return response
  }

  private async storeFactorsResults(
    results: TrainingLoadFactorsResult[],
    dayIdMap: Map<number, string>
  ): Promise<void> {
    for (let i = 0; i < results.length; i++) {
      const result = results[i]
      const dayId = dayIdMap.get(i)

      if (!dayId) {
        console.warn(
          `Could not find dayId for result index ${i} (${result.username_lastname} on ${result.date_of_day})`
        )
        continue
      }

      const metrics: Record<string, number> = {
        ...(result.TL_volume_F1 !== null && result.TL_volume_F1 !== undefined
          ? { TL_volume_F1: result.TL_volume_F1 }
          : {}),
        ...(result.TL_volume_F2 !== null && result.TL_volume_F2 !== undefined
          ? { TL_volume_F2: result.TL_volume_F2 }
          : {}),
        ...(result.TL_HI_F1 !== null && result.TL_HI_F1 !== undefined
          ? { TL_HI_F1: result.TL_HI_F1 }
          : {}),
        ...(result.TL_HI_F2 !== null && result.TL_HI_F2 !== undefined
          ? { TL_HI_F2: result.TL_HI_F2 }
          : {}),
        ...(result.TL_HI_F3 !== null && result.TL_HI_F3 !== undefined
          ? { TL_HI_F3: result.TL_HI_F3 }
          : {}),
        ...(result.TL_NM_F1 !== null && result.TL_NM_F1 !== undefined
          ? { TL_NM_F1: result.TL_NM_F1 }
          : {}),
        ...(result.TL_NM_F2 !== null && result.TL_NM_F2 !== undefined
          ? { TL_NM_F2: result.TL_NM_F2 }
          : {}),
      }

      try {
        await this.dayMetricService.updateMetrics(dayId, {
          ...metrics,
        })
      } catch (error) {
        console.error(
          `Error storing factors results for ${result.username_lastname} on ${result.date_of_day}:`,
          error
        )
      }
    }
  }
}
