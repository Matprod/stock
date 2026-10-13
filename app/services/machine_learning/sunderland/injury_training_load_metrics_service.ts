import { DateTime } from 'luxon'
import Day from '#models_pg/day'
import SportActivity from '#models_pg/sport_activity'
import { MetricService } from '#services/metric_service'
import { MetricDomain } from '#contracts/metric'
import { ewmaScalar, standardDeviation } from '../../../utils/statistics.js'
import Injury from '#models_pg/injury'
import { shouldExcludeDateFromEWMA } from '../../../utils/injury.js'

const divider = '=================================================='
// const debugArray = ['TL_HI_F1', 'TL_HI_F2', 'TL_HI_F3']
const debugArray: string[] = []

export interface InjuryTrainingLoadMetrics {
  // ACWR
  ACWR_exp_TL_HI_F1: number
  ACWR_exp_TL_HI_F2: number
  ACWR_exp_TL_HI_F3: number
  ACWR_exp_TL_NM_F1: number
  ACWR_exp_TL_NM_F2: number
  ACWR_exp_TL_volume_F1: number
  ACWR_exp_TL_volume_F2: number

  // EWMA 28d
  EWMA_28d_TL_HI_F1: number
  EWMA_28d_TL_HI_F2: number
  EWMA_28d_TL_HI_F3: number
  EWMA_28d_TL_NM_F1: number
  EWMA_28d_TL_NM_F2: number
  EWMA_28d_TL_volume_F1: number
  EWMA_28d_TL_volume_F2: number

  // EWMA 7d
  EWMA_7d_TL_HI_F1: number
  EWMA_7d_TL_HI_F2: number
  EWMA_7d_TL_HI_F3: number
  EWMA_7d_TL_NM_F1: number
  EWMA_7d_TL_NM_F2: number
  EWMA_7d_TL_volume_F1: number
  EWMA_7d_TL_volume_F2: number
  EWMA_7d_Body_Soreness: number
  EWMA_7d_Energy: number
  EWMA_7d_Sleep_quality: number

  // Monotony
  monotony_TL_HI_F1: number | null
  monotony_TL_HI_F2: number | null
  monotony_TL_NM_F1: number | null
  monotony_TL_NM_F2: number | null
  monotony_TL_volume_F1: number | null
  monotony_TL_volume_F2: number | null
  monotony_fmp_dynamic_high_duration_ratio: number | null

  // Spike
  spike_TL_HI_F1: number
  spike_TL_HI_F2: number
  spike_TL_HI_F3: number
  spike_TL_NM_F1: number
  spike_TL_NM_F2: number
  spike_TL_volume_F1: number
  spike_TL_volume_F2: number

  // Strain
  strain_TL_volume_F1: number | null
  strain_TL_volume_F2: number | null
  strain_TL_HI_F1: number | null
  strain_TL_HI_F2: number | null
  strain_TL_NM_F1: number | null
  strain_TL_NM_F2: number | null

  // Standard deviation
  std_7d_TL_HI_F3: number | null
  std_7d_fmp_dynamic_high_duration_ratio: number | null

  // Context metrics (7 days)
  HSR_sessions_last_7d: number
  games_last_7d: number
  sessions_last_7d: number
  match_minutes_last_7d: number
  rhie_max_effort_count: number
}

export default class InjuryTrainingLoadMetricsService {
  private dayMetricService: MetricService
  private periodMetricService: MetricService

  constructor() {
    this.dayMetricService = new MetricService(MetricDomain.DAY)
    this.periodMetricService = new MetricService(MetricDomain.PERIOD)
  }

  /**
   * Calculate all training load metrics for a specific day
   */
  public async calculateTrainingLoadMetrics(
    athleteId: string,
    currentDate: DateTime,
    allDays: Day[],
    allActivities: SportActivity[],
    allInjuries?: Injury[]
  ): Promise<InjuryTrainingLoadMetrics> {
    const days7d = allDays.filter(
      (day) =>
        day.athleteId === athleteId &&
        day.dateOfDay &&
        day.dateOfDay <= currentDate &&
        day.dateOfDay >= currentDate.minus({ days: 7 })
    )

    const days7dWithoutCurrentDay = days7d.filter(
      (day) => day.dateOfDay?.toFormat('yyyy-MM-dd') !== currentDate.toFormat('yyyy-MM-dd')
    )

    const days28d = allDays.filter(
      (day) =>
        day.athleteId === athleteId &&
        day.dateOfDay &&
        day.dateOfDay <= currentDate &&
        day.dateOfDay >= currentDate.minus({ days: 28 })
    )
    const days28dWithoutCurrentDay = days28d.filter(
      (day) => day.dateOfDay?.toFormat('yyyy-MM-dd') !== currentDate.toFormat('yyyy-MM-dd')
    )

    const currentDay = allDays.find(
      (day) =>
        day.athleteId === athleteId &&
        day.dateOfDay?.toFormat('yyyy-MM-dd') === currentDate.toFormat('yyyy-MM-dd')
    )

    const currentTLMetrics = currentDay
      ? this.dayMetricService.extractNumericMetrics(currentDay, [
          'TL_volume_F1',
          'TL_volume_F2',
          'TL_HI_F1',
          'TL_HI_F2',
          'TL_HI_F3',
          'TL_NM_F1',
          'TL_NM_F2',
        ])
      : new Map<string, number>()

    const ewma7d_TL_volume_F1 = this.calculateEWMA(
      days7dWithoutCurrentDay,
      'TL_volume_F1',
      7,
      currentDate,
      allInjuries
    )
    const ewma7d_TL_volume_F2 = this.calculateEWMA(
      days7dWithoutCurrentDay,
      'TL_volume_F2',
      7,
      currentDate,
      allInjuries
    )
    const ewma7d_TL_HI_F1 = this.calculateEWMA(
      days7dWithoutCurrentDay,
      'TL_HI_F1',
      7,
      currentDate,
      allInjuries
    )
    const ewma7d_TL_HI_F2 = this.calculateEWMA(
      days7dWithoutCurrentDay,
      'TL_HI_F2',
      7,
      currentDate,
      allInjuries
    )
    const ewma7d_TL_HI_F3 = this.calculateEWMA(
      days7dWithoutCurrentDay,
      'TL_HI_F3',
      7,
      currentDate,
      allInjuries
    )
    const ewma7d_TL_NM_F1 = this.calculateEWMA(
      days7dWithoutCurrentDay,
      'TL_NM_F1',
      7,
      currentDate,
      allInjuries
    )
    const ewma7d_TL_NM_F2 = this.calculateEWMA(
      days7dWithoutCurrentDay,
      'TL_NM_F2',
      7,
      currentDate,
      allInjuries
    )

    const ewma28d_TL_volume_F1 = this.calculateEWMA(
      days28dWithoutCurrentDay,
      'TL_volume_F1',
      28,
      currentDate,
      allInjuries
    )
    const ewma28d_TL_volume_F2 = this.calculateEWMA(
      days28dWithoutCurrentDay,
      'TL_volume_F2',
      28,
      currentDate,
      allInjuries
    )
    const ewma28d_TL_HI_F1 = this.calculateEWMA(
      days28dWithoutCurrentDay,
      'TL_HI_F1',
      28,
      currentDate,
      allInjuries
    )
    const ewma28d_TL_HI_F2 = this.calculateEWMA(
      days28dWithoutCurrentDay,
      'TL_HI_F2',
      28,
      currentDate,
      allInjuries
    )
    const ewma28d_TL_HI_F3 = this.calculateEWMA(
      days28dWithoutCurrentDay,
      'TL_HI_F3',
      28,
      currentDate,
      allInjuries
    )
    const ewma28d_TL_NM_F1 = this.calculateEWMA(
      days28dWithoutCurrentDay,
      'TL_NM_F1',
      28,
      currentDate,
      allInjuries
    )
    const ewma28d_TL_NM_F2 = this.calculateEWMA(
      days28dWithoutCurrentDay,
      'TL_NM_F2',
      28,
      currentDate,
      allInjuries
    )

    // Calculate ACWR (EWMA_7d / EWMA_28d)
    // If both EWMA values are 0, set default value to 1
    const ACWR_exp_TL_volume_F1 =
      ewma7d_TL_volume_F1 === 0 && ewma28d_TL_volume_F1 === 0
        ? 1
        : ewma28d_TL_volume_F1 > 0
          ? ewma7d_TL_volume_F1 / ewma28d_TL_volume_F1
          : 0
    const ACWR_exp_TL_volume_F2 =
      ewma7d_TL_volume_F2 === 0 && ewma28d_TL_volume_F2 === 0
        ? 1
        : ewma28d_TL_volume_F2 > 0
          ? ewma7d_TL_volume_F2 / ewma28d_TL_volume_F2
          : 0
    const ACWR_exp_TL_HI_F1 =
      ewma7d_TL_HI_F1 === 0 && ewma28d_TL_HI_F1 === 0
        ? 1
        : ewma28d_TL_HI_F1 > 0
          ? ewma7d_TL_HI_F1 / ewma28d_TL_HI_F1
          : 0
    // console.log(
    //   `ACWR_exp_TL_HI_F1: ${ACWR_exp_TL_HI_F1}. ewma7d_TL_HI_F1: ${ewma7d_TL_HI_F1}. ewma28d_TL_HI_F1: ${ewma28d_TL_HI_F1}.`
    // )
    const ACWR_exp_TL_HI_F2 =
      ewma7d_TL_HI_F2 === 0 && ewma28d_TL_HI_F2 === 0
        ? 1
        : ewma28d_TL_HI_F2 > 0
          ? ewma7d_TL_HI_F2 / ewma28d_TL_HI_F2
          : 0
    const ACWR_exp_TL_HI_F3 =
      ewma7d_TL_HI_F3 === 0 && ewma28d_TL_HI_F3 === 0
        ? 1
        : ewma28d_TL_HI_F3 > 0
          ? ewma7d_TL_HI_F3 / ewma28d_TL_HI_F3
          : 0
    const ACWR_exp_TL_NM_F1 =
      ewma7d_TL_NM_F1 === 0 && ewma28d_TL_NM_F1 === 0
        ? 1
        : ewma28d_TL_NM_F1 > 0
          ? ewma7d_TL_NM_F1 / ewma28d_TL_NM_F1
          : 0
    const ACWR_exp_TL_NM_F2 =
      ewma7d_TL_NM_F2 === 0 && ewma28d_TL_NM_F2 === 0
        ? 1
        : ewma28d_TL_NM_F2 > 0
          ? ewma7d_TL_NM_F2 / ewma28d_TL_NM_F2
          : 0

    // Calculate Monotony (Mean / StdDev)
    const monotony_TL_volume_F1 = this.calculateMonotony(days7d, 'TL_volume_F1', allInjuries)
    const monotony_TL_volume_F2 = this.calculateMonotony(days7d, 'TL_volume_F2', allInjuries)
    const monotony_TL_HI_F1 = this.calculateMonotony(days7d, 'TL_HI_F1', allInjuries)
    const monotony_TL_HI_F2 = this.calculateMonotony(days7d, 'TL_HI_F2', allInjuries)
    const monotony_TL_NM_F1 = this.calculateMonotony(days7d, 'TL_NM_F1', allInjuries)
    const monotony_TL_NM_F2 = this.calculateMonotony(days7d, 'TL_NM_F2', allInjuries)

    // Calculate fmp_dynamic_high_duration_ratio monotony
    const fmpRatios = this.calculateFmpDynamicHighDurationRatios(days7d, allActivities)
    let monotony_fmp_dynamic_high_duration_ratio: number | null = null
    if (fmpRatios.length > 0) {
      const mean = fmpRatios.reduce((sum, val) => sum + val, 0) / fmpRatios.length
      const std = standardDeviation(fmpRatios)
      monotony_fmp_dynamic_high_duration_ratio = std !== null ? mean / Math.max(std, 0.1) : null
    }

    // Calculate Spike (Current / EWMA_7d)
    const current_TL_volume_F1 = currentTLMetrics.get('TL_volume_F1')
    const current_TL_volume_F2 = currentTLMetrics.get('TL_volume_F2')
    const current_TL_HI_F1 = currentTLMetrics.get('TL_HI_F1')
    const current_TL_HI_F2 = currentTLMetrics.get('TL_HI_F2')
    const current_TL_HI_F3 = currentTLMetrics.get('TL_HI_F3')
    const current_TL_NM_F1 = currentTLMetrics.get('TL_NM_F1')
    const current_TL_NM_F2 = currentTLMetrics.get('TL_NM_F2')

    const spike_TL_volume_F1 = this.calculateSpike(
      current_TL_volume_F1,
      ewma7d_TL_volume_F1,
      'TL_volume_F1'
    )
    const spike_TL_volume_F2 = this.calculateSpike(
      current_TL_volume_F2,
      ewma7d_TL_volume_F2,
      'TL_volume_F2'
    )
    const spike_TL_HI_F1 = this.calculateSpike(current_TL_HI_F1, ewma7d_TL_HI_F1, 'TL_HI_F1')
    const spike_TL_HI_F2 = this.calculateSpike(current_TL_HI_F2, ewma7d_TL_HI_F2, 'TL_HI_F2')
    const spike_TL_HI_F3 = this.calculateSpike(current_TL_HI_F3, ewma7d_TL_HI_F3, 'TL_HI_F3')
    const spike_TL_NM_F1 = this.calculateSpike(current_TL_NM_F1, ewma7d_TL_NM_F1, 'TL_NM_F1')
    const spike_TL_NM_F2 = this.calculateSpike(current_TL_NM_F2, ewma7d_TL_NM_F2, 'TL_NM_F2')

    // Calculate Strain (Sum over 7 days × Monotony)
    const strain_TL_volume_F1 = this.calculateStrain(
      days7d,
      'TL_volume_F1',
      monotony_TL_volume_F1,
      allInjuries
    )
    const strain_TL_volume_F2 = this.calculateStrain(
      days7d,
      'TL_volume_F2',
      monotony_TL_volume_F2,
      allInjuries
    )
    const strain_TL_HI_F1 = this.calculateStrain(days7d, 'TL_HI_F1', monotony_TL_HI_F1, allInjuries)
    const strain_TL_HI_F2 = this.calculateStrain(days7d, 'TL_HI_F2', monotony_TL_HI_F2, allInjuries)
    const strain_TL_NM_F1 = this.calculateStrain(days7d, 'TL_NM_F1', monotony_TL_NM_F1, allInjuries)
    const strain_TL_NM_F2 = this.calculateStrain(days7d, 'TL_NM_F2', monotony_TL_NM_F2, allInjuries)

    // Calculate Standard deviation
    const stdTLHI3 = this.calculateStdDev(days7d, 'TL_HI_F3', allInjuries)
    const std_7d_TL_HI_F3 = stdTLHI3 !== null ? Math.max(stdTLHI3, 0.1) : null
    const stdFmpDynamicHighDurationRatio = standardDeviation(fmpRatios)
    const std_7d_fmp_dynamic_high_duration_ratio =
      stdFmpDynamicHighDurationRatio !== null ? Math.max(stdFmpDynamicHighDurationRatio, 0.1) : null

    // Calculate EWMA for subjective metrics
    const ewma7d_Body_Soreness = this.calculateEWMASubjective(days7d, 'Body Soreness', allInjuries)
    const ewma7d_Energy = this.calculateEWMASubjective(days7d, 'Energy', allInjuries)
    const ewma7d_Sleep_quality = this.calculateEWMASubjective(days7d, 'Sleep quality', allInjuries)

    // Calculate context metrics
    const contextMetrics = this.calculateContextMetrics(
      athleteId,
      currentDate,
      allActivities,
      allInjuries
    )

    return {
      ACWR_exp_TL_HI_F1,
      ACWR_exp_TL_HI_F2,
      ACWR_exp_TL_HI_F3,
      ACWR_exp_TL_NM_F1,
      ACWR_exp_TL_NM_F2,
      ACWR_exp_TL_volume_F1,
      ACWR_exp_TL_volume_F2,
      EWMA_28d_TL_HI_F1: ewma28d_TL_HI_F1,
      EWMA_28d_TL_HI_F2: ewma28d_TL_HI_F2,
      EWMA_28d_TL_HI_F3: ewma28d_TL_HI_F3,
      EWMA_28d_TL_NM_F1: ewma28d_TL_NM_F1,
      EWMA_28d_TL_NM_F2: ewma28d_TL_NM_F2,
      EWMA_28d_TL_volume_F1: ewma28d_TL_volume_F1,
      EWMA_28d_TL_volume_F2: ewma28d_TL_volume_F2,
      EWMA_7d_TL_HI_F1: ewma7d_TL_HI_F1,
      EWMA_7d_TL_HI_F2: ewma7d_TL_HI_F2,
      EWMA_7d_TL_HI_F3: ewma7d_TL_HI_F3,
      EWMA_7d_TL_NM_F1: ewma7d_TL_NM_F1,
      EWMA_7d_TL_NM_F2: ewma7d_TL_NM_F2,
      EWMA_7d_TL_volume_F1: ewma7d_TL_volume_F1,
      EWMA_7d_TL_volume_F2: ewma7d_TL_volume_F2,
      EWMA_7d_Body_Soreness: ewma7d_Body_Soreness,
      EWMA_7d_Energy: ewma7d_Energy,
      EWMA_7d_Sleep_quality: ewma7d_Sleep_quality,
      monotony_TL_HI_F1,
      monotony_TL_HI_F2,
      monotony_TL_NM_F1,
      monotony_TL_NM_F2,
      monotony_TL_volume_F1,
      monotony_TL_volume_F2,
      monotony_fmp_dynamic_high_duration_ratio,
      spike_TL_HI_F1,
      spike_TL_HI_F2,
      spike_TL_HI_F3,
      spike_TL_NM_F1,
      spike_TL_NM_F2,
      spike_TL_volume_F1,
      spike_TL_volume_F2,
      strain_TL_volume_F1,
      strain_TL_volume_F2,
      strain_TL_HI_F1,
      strain_TL_HI_F2,
      strain_TL_NM_F1,
      strain_TL_NM_F2,
      std_7d_TL_HI_F3,
      std_7d_fmp_dynamic_high_duration_ratio,
      ...contextMetrics,
    }
  }

  private calculateSpike(
    currentValue: number | undefined,
    ewma: number,
    metricName?: string
  ): number {
    const debug = metricName && debugArray.includes(metricName)
    if (debug) console.log(divider)
    if (!ewma && currentValue) {
      if (debug)
        console.log(
          `|spike(${metricName})| returning NaN because ewma is ${ewma} and currentValue is ${currentValue}`
        )
      return Number.NaN
    }
    if (!currentValue && !ewma) {
      if (debug)
        console.log(
          `|spike(${metricName})| returning 0 because ewma is ${ewma} and currentValue is ${currentValue}`
        )
      return 0
    }
    if (debug)
      console.log(
        `|spike(${metricName})| returning currentValue / ewma = ${currentValue ?? 0} / ${ewma} = ${(currentValue ?? 0) / ewma}`
      )
    if (debug) console.log(divider)
    return (currentValue ?? 0) / ewma
  }

  private calculateEWMA(
    days: Day[],
    metricName: string,
    period: number,
    currentDate: DateTime,
    allInjuries?: Injury[]
  ): number {
    const debug = debugArray.includes(metricName)
    if (debug) console.log(divider)
    const values: number[] = []

    const startDate = currentDate.minus({ days: period })
    const daysMap = new Map<string, Day>()

    for (const day of days) {
      if (day.dateOfDay) {
        const dateKey = day.dateOfDay.toFormat('yyyy-MM-dd')
        daysMap.set(dateKey, day)
      }
    }

    for (let i = 0; i < period; i++) {
      const dayDate = startDate.plus({ days: i })
      const dateKey = dayDate.toFormat('yyyy-MM-dd')
      const day = daysMap.get(dateKey)

      if (
        allInjuries &&
        shouldExcludeDateFromEWMA(allInjuries, dayDate, { excludeInjuryDatePlusOne: true })
      ) {
        if (debug)
          console.log(
            `|ewma ${days.length} days (${metricName})| Excluding day ${dayDate.toFormat('yyyy-MM-dd')} because it is in the injury history`
          )
        values.push(0)
        continue
      }

      if (day) {
        const metricMap = this.dayMetricService.extractNumericMetrics(day, [metricName])
        const value = metricMap.get(metricName)
        if (value !== undefined && value !== null && !isNaN(value)) {
          values.push(value)
          if (debug)
            console.log(
              `|ewma ${days.length} days (${metricName})| Value for the day ${day.dateOfDay?.toFormat('yyyy-MM-dd')} is ${value}`
            )
        } else {
          values.push(0)
          if (debug)
            console.log(
              `|ewma ${days.length} days (${metricName})| Value for the day ${day.dateOfDay?.toFormat('yyyy-MM-dd')} is 0 because it has a subjective metric`
            )
        }
      } else {
        if (debug)
          console.log(
            `|ewma ${days.length} days (${metricName})| Value for the day ${dayDate.toFormat('yyyy-MM-dd')} is 0 because it is not found`
          )
        values.push(0)
      }
    }

    // if (metricName === 'TL_HI_F1') {
    //   console.log(
    //     `|ewma| For the period ${startDate.toFormat('yyyy-MM-dd')} to ${currentDate.minus({ days: 1 }).toFormat('yyyy-MM-dd')} the values are ${values.join(', ')}`
    //   )
    // }

    if (values.length === 0) {
      if (debug)
        console.log(
          `|ewma ${days.length} days (${metricName})| returning 0 because values.length is ${values.length}`
        )
      return 0
    }

    const alpha = 2 / (period + 1)
    const result = ewmaScalar(values.reverse(), alpha)
    if (debug) {
      console.log(`|ewma ${days.length} days (${metricName})| values are ${values.join(', ')}`)
      console.log(`|ewma ${days.length} days (${metricName})| alpha is ${alpha}`)
      console.log(`|ewma ${days.length} days (${metricName})| result is ${result}`)
      console.log(divider)
    }
    return result
  }

  private calculateEWMASubjective(
    days: Day[],
    metricName: 'Energy' | 'Sleep quality' | 'Body Soreness',
    allInjuries?: Injury[]
  ): number {
    const getValue = (day: Day): number | null => {
      switch (metricName) {
        case 'Energy':
          return day.health?.energyRating ?? null
        case 'Sleep quality':
          return day.sleeps?.[0]?.qualityRating ?? null
        case 'Body Soreness':
          return day.health?.bodySorenessRating ?? null
      }
    }

    const sortedDays = days
      .filter((d) => d.dateOfDay)
      .sort((a, b) => a.dateOfDay!.toMillis() - b.dateOfDay!.toMillis())

    const values: number[] = []

    let missingDaysBetweenValues = 0
    let isFirstValue = true

    for (const day of sortedDays) {
      if (allInjuries && day.dateOfDay && shouldExcludeDateFromEWMA(allInjuries, day.dateOfDay)) {
        continue
      }

      const value = getValue(day)

      if (value !== null && !isNaN(value)) {
        if (!isFirstValue && missingDaysBetweenValues >= 3) {
          return Number.NaN
        }
        values.push(value)
        isFirstValue = false
        missingDaysBetweenValues = 0
      } else if (!isFirstValue) {
        missingDaysBetweenValues++
      }
    }

    if (values.length === 0) {
      return Number.NaN
    }

    if (values.length === 1) {
      return values[0]
    }

    const alpha = 2 / (7 + 1)
    return ewmaScalar(values.reverse(), alpha)
  }

  private calculateMonotony(
    days: Day[],
    metricName: string,
    allInjuries?: Injury[]
  ): number | null {
    const debug = debugArray.includes(metricName)
    if (debug) console.log(divider)
    const values: number[] = []
    for (const day of days) {
      if (allInjuries && day.dateOfDay && shouldExcludeDateFromEWMA(allInjuries, day.dateOfDay)) {
        if (debug)
          console.log(
            `|monotony(${metricName})| Excluding day ${day.dateOfDay?.toFormat('yyyy-MM-dd')} because it is in the injury history`
          )
        continue
      }

      const hasSubjectiveMetric =
        day.health?.energyRating !== undefined ||
        day.sleeps?.[0]?.qualityRating !== undefined ||
        day.health?.bodySorenessRating !== undefined

      const metricMap = this.dayMetricService.extractNumericMetrics(day, [metricName])
      const value = metricMap.get(metricName)
      if (value !== undefined && value !== null && !isNaN(value)) {
        values.push(value)
        if (debug)
          console.log(
            `|monotony(${metricName})| value for the day ${day.dateOfDay?.toFormat('yyyy-MM-dd')} is ${value}`
          )
      } else if (hasSubjectiveMetric) {
        values.push(0)
        if (debug)
          console.log(
            `|monotony(${metricName})| value for the day ${day.dateOfDay?.toFormat('yyyy-MM-dd')} is 0 because it has a subjective metric`
          )
        continue
      }
    }

    if (values.length === 0) {
      if (debug)
        console.log(
          `|monotony(${metricName})| returning 0 because values.length is ${values.length}`
        )
      return 0
    }

    const mean = values.reduce((sum, val) => sum + val, 0) / values.length
    const std = standardDeviation(values)
    if (debug) {
      console.log(`|monotony(${metricName})| values are ${values.join(', ')}`)
      console.log(`|monotony(${metricName})| mean is ${mean}`)
      console.log(`|monotony(${metricName})| std is ${std}`)
      console.log(
        `|monotony(${metricName})| result is ${std !== null ? mean / Math.max(std, 0.1) : null}`
      )
      console.log(divider)
    }
    return std !== null ? mean / Math.max(std, 0.1) : null
  }

  private calculateStrain(
    days: Day[],
    metricName: string,
    monotony: number | null,
    allInjuries?: Injury[]
  ): number | null {
    const debug = debugArray.includes(metricName)

    if (monotony === null) {
      return null
    }

    const values: number[] = []
    if (debug) console.log(divider)
    for (const day of days) {
      if (allInjuries && day.dateOfDay && shouldExcludeDateFromEWMA(allInjuries, day.dateOfDay)) {
        if (debug)
          console.log(
            `|strain(${metricName})| Excluding day ${day.dateOfDay?.toFormat('yyyy-MM-dd')} because it is in the injury history`
          )
        // values.push(0)
        continue
      }

      const hasSubjectiveMetric =
        day.health?.energyRating !== undefined ||
        day.sleeps?.[0]?.qualityRating !== undefined ||
        day.health?.bodySorenessRating !== undefined

      const metricMap = this.dayMetricService.extractNumericMetrics(day, [metricName])
      const value = metricMap.get(metricName)
      if (value !== undefined && value !== null && !isNaN(value)) {
        if (debug)
          console.log(
            `|strain(${metricName})| value for the day ${day.dateOfDay?.toFormat('yyyy-MM-dd')} is ${value}`
          )
        values.push(value)
      } else if (hasSubjectiveMetric) {
        if (debug)
          console.log(
            `|strain(${metricName})| value for the day ${day.dateOfDay?.toFormat('yyyy-MM-dd')} is 0 because it has a subjective metric`
          )
        values.push(0)
        continue
      }
    }

    if (values.length === 0 || monotony === 0) {
      if (debug)
        console.log(
          `|strain(${metricName})| returning 0 because values.length is ${values.length} or monotony is ${monotony}`
        )
      return 0
    }

    const sum = values.reduce((sum, val) => sum + val, 0)
    const average = sum / values.length
    if (debug) {
      console.log(`|strain(${metricName})| values are ${values.join(', ')}`)
      console.log(`|strain(${metricName})| sum is ${sum}`)
      console.log(`|strain(${metricName})| average is ${average}`)
      console.log(`|strain(${metricName})| monotony is ${monotony}`)
      console.log(`|strain(${metricName})| result is ${average * monotony}`)
      console.log(divider)
    }
    return average * monotony
  }

  private calculateStdDev(days: Day[], metricName: string, allInjuries?: Injury[]): number | null {
    const debug = debugArray.includes(metricName)
    if (debug) console.log(divider)
    const values: number[] = []
    for (const day of days) {
      if (allInjuries && day.dateOfDay && shouldExcludeDateFromEWMA(allInjuries, day.dateOfDay)) {
        if (debug)
          console.log(
            `|stdDev(${metricName})| Excluding day ${day.dateOfDay?.toFormat('yyyy-MM-dd')} because it is in the injury history`
          )
        // values.push(0)
        continue
      }

      const hasSubjectiveMetric =
        day.health?.energyRating !== undefined ||
        day.sleeps?.[0]?.qualityRating !== undefined ||
        day.health?.bodySorenessRating !== undefined

      const metricMap = this.dayMetricService.extractNumericMetrics(day, [metricName])
      const value = metricMap.get(metricName)
      if (value !== undefined && value !== null && !isNaN(value)) {
        values.push(value)
        if (debug)
          console.log(
            `|stdDev(${metricName})| value for the day ${day.dateOfDay?.toFormat('yyyy-MM-dd')} is ${value}`
          )
      } else if (hasSubjectiveMetric) {
        if (debug)
          console.log(
            `|stdDev(${metricName})| value for the day ${day.dateOfDay?.toFormat('yyyy-MM-dd')} is 0 because it has a subjective metric`
          )
        values.push(0)
        continue
      }

      // if (metricName === 'TL_HI_F3') {
      //   console.log(
      //     `|stdDev| For the day ${day.dateOfDay?.toFormat('yyyy-MM-dd')} the value is ${value}, hasSubjectiveMetric: ${hasSubjectiveMetric}`
      //   )
      // }
    }

    // if (metricName === 'TL_HI_F3') {
    //   console.log(
    //     `|stdDev| For the days ${days.map((d) => d.dateOfDay?.toFormat('yyyy-MM-dd')).join(', ')} the values are ${values.join(', ')}`
    //   )
    // }

    if (debug) {
      console.log(`|stdDev(${metricName})| values are ${values.join(', ')}`)
      console.log(`|stdDev(${metricName})| result is ${standardDeviation(values)}`)
      console.log(divider)
    }
    return standardDeviation(values)
  }

  private calculateFmpDynamicHighDurationRatios(
    days: Day[],
    allActivities: SportActivity[]
  ): number[] {
    const ratios: number[] = []
    const activitiesByDate = new Map<string, SportActivity[]>()

    for (const activity of allActivities) {
      if (!activity.day?.dateOfDay) continue
      const dateKey = activity.day.dateOfDay.toFormat('yyyy-MM-dd')
      if (!activitiesByDate.has(dateKey)) {
        activitiesByDate.set(dateKey, [])
      }
      activitiesByDate.get(dateKey)!.push(activity)
    }

    for (const day of days) {
      if (!day.dateOfDay) continue
      const dateKey = day.dateOfDay.toFormat('yyyy-MM-dd')
      const dayActivities = activitiesByDate.get(dateKey) || []

      let fmpDynamicSum = 0
      let fieldTimeSum = 0

      for (const activity of dayActivities) {
        for (const period of activity.periods || []) {
          const { fmp_dynamic_high_duration, field_time } =
            this.periodMetricService.extractNumericMetricsAsObject(period, [
              'fmp_dynamic_high_duration',
              'field_time',
            ])

          if (fmp_dynamic_high_duration !== null) {
            fmpDynamicSum += fmp_dynamic_high_duration
          }
          if (field_time !== null) {
            fieldTimeSum += field_time
          }
        }
      }
      const hasSubjectiveMetric =
        day.health?.energyRating !== undefined ||
        day.sleeps?.[0]?.qualityRating !== undefined ||
        day.health?.bodySorenessRating !== undefined

      if (fieldTimeSum > 0) {
        ratios.push(fmpDynamicSum / fieldTimeSum)
      } else if (hasSubjectiveMetric) {
        ratios.push(0)
        continue
      }
    }

    return ratios
  }

  private calculateContextMetrics(
    athleteId: string,
    currentDate: DateTime,
    allActivities: SportActivity[],
    allInjuries?: Injury[]
  ): {
    HSR_sessions_last_7d: number
    games_last_7d: number
    sessions_last_7d: number
    match_minutes_last_7d: number
    rhie_max_effort_count: number
  } {
    const startDate = currentDate.minus({ days: 7 })
    const currentDateStr = currentDate.toFormat('yyyy-MM-dd')

    const activities: SportActivity[] = []
    const currentDayActivities: SportActivity[] = []

    for (const activity of allActivities) {
      if (allInjuries && activity.day?.dateOfDay) {
        if (shouldExcludeDateFromEWMA(allInjuries, activity.day.dateOfDay)) {
          continue
        }
      }
      if (activity.day?.athleteId === athleteId && activity.day?.dateOfDay) {
        const activityDateStr = activity.day.dateOfDay.toFormat('yyyy-MM-dd')

        if (
          activity.day.dateOfDay >= startDate &&
          activity.day.dateOfDay <= currentDate
        ) {
          activities.push(activity)
        }

        if (activityDateStr === currentDateStr) {
          currentDayActivities.push(activity)
        }
      }
    }

    let sessions_last_7d = activities.length
    let games_last_7d = 0
    let match_minutes_last_7d = 0
    let HSR_sessions_last_7d = 0
    let rhie_max_effort_count = 0

    const hsrActivityIds = new Set<string>()

    for (const activity of activities) {
      if (activity.day?.dateOfDay?.toFormat('yyyy-MM-dd') === '2025-07-11') {
        // log every periods
        // console.log(`Periods for activity ${activity.id} (${activity.activityName}):`)
        // for (const period of activity.periods || []) {
        //   console.log(period.name)
        // }
      }
      if (activity.gameActivity) {
        games_last_7d++
        for (const period of activity.periods || []) {
          const { field_time } = this.periodMetricService.extractNumericMetricsAsObject(period, [
            'field_time',
          ])
          if (field_time !== null) {
            match_minutes_last_7d += field_time / 60
          }
        }
      }

      const containsHSR = activity.periods?.some(
        (period) => period.name && period.name.toUpperCase().includes('HSR')
      )
      if (containsHSR || activity.gameActivity) {
        hsrActivityIds.add(activity.id)
      }
    }

    for (const activity of currentDayActivities) {
      for (const period of activity.periods || []) {
        const { rhie_max_effort_count: rhieCount } =
          this.periodMetricService.extractNumericMetricsAsObject(period, ['rhie_max_effort_count'])
        if (rhieCount !== null) {
          rhie_max_effort_count += rhieCount
        }
      }
    }

    HSR_sessions_last_7d = hsrActivityIds.size

    return {
      HSR_sessions_last_7d,
      games_last_7d,
      sessions_last_7d,
      match_minutes_last_7d,
      rhie_max_effort_count,
    }
  }
}
