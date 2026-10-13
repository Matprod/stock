import { CalculateScoreDataPayload, DayScoreData, SleepScores } from '#contracts/score'
import { DateTime } from 'luxon'
import { ewmaScalar, standardDeviation } from '../../utils/statistics.js'

export default class SleepScoreService {
  private readonly N_VALUE = 7
  private readonly ALPHA_VALUE = 2 / (this.N_VALUE + 1)

  async calculateSleepScore(
    data: CalculateScoreDataPayload,
    date: string
  ): Promise<SleepScores | null> {
    const { days } = data

    const sortedDays = [...days].sort((a, b) => a.date.getTime() - b.date.getTime())

    const targetDate = DateTime.fromFormat(date, 'yyyy-MM-dd').toJSDate()
    const currentDay = sortedDays.find((day) => day.date.getTime() === targetDate.getTime())

    if (!currentDay) {
      throw new Error(`No data found for date 3 ${date}`)
    }

    const { sleep } = currentDay

    if (!sleep.hasSleep) {
      return null
    }

    const last7days = sortedDays.filter((day) => {
      const dayDate = new Date(day.date)
      const diffTime = Math.abs(targetDate.getTime() - dayDate.getTime())
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
      return diffDays <= 6
    })

    const sleepQuality7Days = last7days
      .map((day) => day.sleep.qualityRating)
      .filter((quality) => quality !== null)
    const sleepQualityVariability = standardDeviation(sleepQuality7Days)

    const last7daysRatioSleepQuantityBaseline = last7days
      .map((day) => day.sleep.ratioSleepQuantityBaseline)
      .filter((ratio) => ratio !== null)

    const ewmaRatioSleepQuantityBaseline = ewmaScalar(
      last7daysRatioSleepQuantityBaseline,
      this.ALPHA_VALUE
    )

    const last7daysQuantity = last7days
      .map((day) => {
        return day.sleep.sleepDurationHours
      })
      .filter((duration) => {
        const isValid = duration !== null
        return isValid
      })

    const alphaForQuantity = 2 / (last7daysQuantity.length + 1)
    const ewmaQuantity = ewmaScalar(last7daysQuantity, alphaForQuantity)

    const sleepScores: SleepScores = {
      ewmaSleepEfficiency: null,
      ewmaSleepConsistency: null,
      ewmaQuantity: null,
      ewmaQuality: null,
      sleepQualityVariability: null,
      sleepDebt: null,
      ewmaRestorative: null,
      debtScore: null,
      restorativeToday: null,
      efficiencyToday: null,
      consistencyToday: null,
      restorativeScore: null,
      consistencyScore: null,
      bedtimeConsistencyScore: null,
      efficiencyScore: null,
      ratioSleepQuantityBaselineToday: null,
      ratioSleepQuantityBaselineEwma: null,
      quantityScore: null,
      quantityToday: null,
      qualityToday: null,
      qualityScore: null,
    }

    const { efficiencyToday, efficiencyEwma, efficiencyScoreToday } =
      this.handleSleepEfficiencyData(
        sleep.sleepEfficiency,
        sleep.lastEwmaSleepEfficiency,
        this.ALPHA_VALUE
      )

    const { consistencyToday, consistencyEwma, consistencyScoreToday } =
      this.handleSleepConsistencyData(
        sleep.sleepConsistency,
        sleep.lastEwmaSleepConsistency,
        this.ALPHA_VALUE,
        last7days
      )

    const { bedtimeConsistencyScore } = this.handleBedtimeConsistencyData(last7days)

    const { qualityToday, qualityEwma, qualityScoreToday } = this.handleQualityData(
      sleep.qualityRating,
      sleep.lastEwmaQuality,
      sleepQualityVariability,
      this.ALPHA_VALUE
    )

    const { sleepDebt, debtScoreToday } = this.handleSleepDebtData(sleep.sleepDebt)

    const { restorativeToday, restorativeEwma, restorativeScoreToday } =
      this.handleSleepRepartitionData(
        sleep.sleepRestorative,
        sleep.lastEwmaRestorative,
        this.ALPHA_VALUE
      )

    const { quantityToday, quantityScoreToday } = this.handleQuantityData(
      ewmaRatioSleepQuantityBaseline,
      ewmaQuantity
    )

    sleepScores.efficiencyToday = efficiencyToday
    sleepScores.ewmaSleepEfficiency = efficiencyEwma
    sleepScores.efficiencyScore = efficiencyScoreToday

    sleepScores.consistencyToday = consistencyToday
    sleepScores.ewmaSleepConsistency = consistencyEwma
    sleepScores.consistencyScore = consistencyScoreToday

    sleepScores.qualityToday = qualityToday
    sleepScores.ewmaQuality = qualityEwma
    sleepScores.qualityScore = qualityScoreToday
    sleepScores.sleepQualityVariability = sleepQualityVariability

    sleepScores.sleepDebt = sleepDebt
    sleepScores.debtScore = debtScoreToday

    sleepScores.restorativeToday = restorativeToday
    sleepScores.ewmaRestorative = restorativeEwma
    sleepScores.restorativeScore = restorativeScoreToday

    // sleepScores.ratioSleepQuantityBaselineToday = ewmaRatioSleepQuantityBaseline
    sleepScores.ratioSleepQuantityBaselineEwma = ewmaRatioSleepQuantityBaseline
    sleepScores.quantityScore = quantityScoreToday
    sleepScores.ewmaQuantity = ewmaQuantity
    sleepScores.quantityToday = quantityToday

    sleepScores.bedtimeConsistencyScore = bedtimeConsistencyScore

    return sleepScores
  }

  private handleSleepEfficiencyData(
    sleepEfficiency: number | null,
    lastEwmaSleepEfficiency: number | null,
    alphaValue: number
  ) {
    const sleepEfficiencyToday = sleepEfficiency
    let efficiencyEwma: number | null = null
    let efficiencyScoreToday: number | null = null

    if (sleepEfficiencyToday !== null) {
      if (lastEwmaSleepEfficiency === null) {
        efficiencyEwma = sleepEfficiencyToday
      } else {
        efficiencyEwma =
          sleepEfficiencyToday * alphaValue + (1 - alphaValue) * lastEwmaSleepEfficiency
      }

      const efficiencyList: number[] = []
      const thresholds = [94, 90, 85, 55]
      for (const threshold of thresholds) {
        efficiencyList.push(efficiencyEwma >= threshold ? 1 : 0)
      }

      efficiencyScoreToday =
        (efficiencyList.reduce((sum, val) => sum + val, 0) / efficiencyList.length) * 100
    }

    return {
      efficiencyToday: sleepEfficiencyToday,
      efficiencyEwma,
      efficiencyScoreToday,
    }
  }

  private handleSleepConsistencyData(
    sleepConsistency: number | null,
    lastEwmaSleepConsistency: number | null,
    alphaValue: number,
    last7days: DayScoreData[]
  ) {
    let consistencyEwma: number | null = null
    let consistencyScoreToday: number | null = null
    let calculatedConsistency: number | null = null

    // If sleepConsistency is not available, calculate it using SRI algorithm
    if (sleepConsistency === null) {
      calculatedConsistency = this.calculateSleepRegularityIndex(last7days)
    }

    const finalConsistency = sleepConsistency ?? calculatedConsistency

    if (finalConsistency !== null) {
      if (lastEwmaSleepConsistency === null) {
        consistencyEwma = finalConsistency
      } else {
        consistencyEwma =
          finalConsistency * alphaValue + (1 - alphaValue) * lastEwmaSleepConsistency
      }

      const consistencyList: number[] = []
      const thresholds = [75, 65, 50, 35]
      for (const threshold of thresholds) {
        consistencyList.push(consistencyEwma >= threshold ? 1 : 0)
      }

      consistencyScoreToday =
        (consistencyList.reduce((sum, val) => sum + val, 0) / consistencyList.length) * 100

      return {
        consistencyToday: finalConsistency,
        consistencyEwma,
        consistencyScoreToday,
      }
    }

    return {
      consistencyToday: null,
      consistencyEwma: null,
      consistencyScoreToday: null,
    }
  }

  private handleQualityData(
    qualityRating: number | null,
    lastEwmaQuality: number | null,
    variability: number | null,
    alphaValue: number
  ) {
    let qualityToday: number | null = null
    let qualityEwma: number | null = null
    let qualityScoreToday: number | null = null

    if (qualityRating !== null) {
      qualityToday = qualityRating
      qualityEwma =
        lastEwmaQuality === null
          ? qualityToday
          : qualityToday * alphaValue + (1 - alphaValue) * lastEwmaQuality

      const qualityList: number[] = []
      const thresholds = [
        1.0, 1.25, 1.5, 1.75, 2.0, 2.25, 2.5, 2.75, 3.0, 3.25, 3.5, 3.75, 4.0, 4.25, 4.5, 4.75, 5.0,
      ]

      const finalQuality = variability !== null ? qualityEwma * Math.exp(-variability / 2) : qualityEwma

      for (const threshold of thresholds) {
        qualityList.push(finalQuality >= threshold ? 1 : 0)
      }

      qualityScoreToday =
        (qualityList.reduce((sum, val) => sum + val, 0) / qualityList.length) * 100
    }

    return {
      qualityToday,
      qualityEwma,
      qualityScoreToday,
    }
  }

  private handleSleepDebtData(sleepDebtMilli: number | null) {
    let sleepDebt: number | null = null
    let debtScoreToday: number | null = null

    if (sleepDebtMilli !== null) {
      sleepDebt = sleepDebtMilli / (1000 * 60 * 60) // Convert to hours

      const debtList: number[] = []
      const thresholds = [0.5, 0.75, 1.0, 1.5]
      for (const threshold of thresholds) {
        debtList.push(sleepDebt <= threshold ? 1 : 0)
      }

      debtScoreToday = (debtList.reduce((sum, val) => sum + val, 0) / debtList.length) * 100
    }

    return {
      sleepDebt,
      debtScoreToday,
    }
  }

  private handleSleepRepartitionData(
    sleepRestorative: number | null,
    lastEwmaRestorative: number | null,
    alphaValue: number
  ) {
    const restorativeToday = sleepRestorative
    let restorativeEwma: number | null = null
    let restorativeScoreToday: number | null = null

    if (restorativeToday !== null) {
      if (lastEwmaRestorative === null) {
        restorativeEwma = restorativeToday
      } else {
        restorativeEwma = restorativeToday * alphaValue + (1 - alphaValue) * lastEwmaRestorative
      }

      const restorativeList: number[] = []
      const thresholds = [55, 50, 40, 30]
      for (const threshold of thresholds) {
        restorativeList.push(restorativeEwma >= threshold ? 1 : 0)
      }

      restorativeScoreToday =
        (restorativeList.reduce((sum, val) => sum + val, 0) / restorativeList.length) * 100
    }

    return {
      restorativeToday,
      restorativeEwma,
      restorativeScoreToday,
    }
  }

  private handleQuantityData(
    ewmaRatioSleepQuantityBaseline: number | null,
    sleepDurationHours: number | null
  ) {
    const quantityToday = sleepDurationHours
    let quantityScoreToday: number | null = null

    if (ewmaRatioSleepQuantityBaseline !== null) {
      const quantityList: number[] = []
      const thresholds = [90, 80, 70, 50]
      for (const threshold of thresholds) {
        quantityList.push(ewmaRatioSleepQuantityBaseline >= threshold ? 1 : 0)
      }

      quantityScoreToday =
        (quantityList.reduce((sum, val) => sum + val, 0) / quantityList.length) * 100
    } else if (sleepDurationHours !== null) {
      const quantityList: number[] = []
      const thresholds = [5, 6, 7]
      for (const threshold of thresholds) {
        quantityList.push(sleepDurationHours >= threshold ? 1 : 0)
      }

      quantityScoreToday =
        (quantityList.reduce((sum, val) => sum + val, 0) / quantityList.length) * 100
    }

    return {
      quantityToday: quantityToday ?? sleepDurationHours,
      quantityScoreToday,
    }
  }

  /**
   * Calculate the Sleep Regularity Index (SRI) for sleep consistency.
   *
   * The SRI measures sleep schedule consistency by calculating the probability
   * that a person is in the same state (awake or asleep) at the same time
   * on consecutive days over the 7-day period.
   *
   * @param last7days Array of sleep data for the last 7 days
   * @returns SRI score (0-100, higher = more regular) or null if insufficient data
   */
  private calculateSleepRegularityIndex(last7days: DayScoreData[]): number | null {
    if (last7days.length < 2) {
      return null
    }

    // Filter days with valid sleep data (bedtime and wake up times)
    const validSleepDays = last7days.filter((day) => {
      const sleep = day.sleep
      return sleep.bedtimeDate && sleep.wakeUpDate
    })

    if (validSleepDays.length < 2) {
      return null
    }

    // Create hourly sleep state matrix for each day
    const dailyStates: Map<string, number[]> = new Map()

    for (const day of validSleepDays) {
      const sleep = day.sleep
      const date = day.date

      if (!sleep.bedtimeDate || !sleep.wakeUpDate) continue

      const { bedtimeDate: bedtime, wakeUpDate: waketime } = sleep

      // Create 24-hour state array (0 = awake, 1 = asleep)
      const hourlyStates = new Array(24).fill(0)

      // Extract hour for bedtime and waketime
      const bedtimeHour = bedtime.minute > 0 ? bedtime.hour + 1 : bedtime.hour
      const waketimeHour = waketime.minute > 0 ? waketime.hour + 1 : waketime.hour

      // Handle sleep periods that cross midnight
      if (bedtimeHour <= waketimeHour) {
        // Sleep period within same day (rare case)
        for (let hour = bedtimeHour; hour < waketimeHour; hour++) {
          hourlyStates[hour] = 1
        }
      } else {
        // Sleep period crosses midnight (normal case)
        // Asleep from bedtime hour to end of day
        for (let hour = bedtimeHour; hour < 24; hour++) {
          hourlyStates[hour] = 1
        }
        // Asleep from start of day to wake hour
        for (let hour = 0; hour < waketimeHour; hour++) {
          hourlyStates[hour] = 1
        }
      }

      const dateKey = date.toISOString().split('T')[0]
      dailyStates.set(dateKey, hourlyStates)
    }

    // Need at least 2 days to calculate consistency
    if (dailyStates.size < 2) {
      return null
    }

    // Get consecutive day pairs
    const dates = Array.from(dailyStates.keys()).sort()
    const consecutiveMatches: number[][] = []

    for (let i = 0; i < dates.length - 1; i++) {
      const currentDate = dates[i]
      const nextDate = dates[i + 1]

      // Check if dates are consecutive (within 2 days to allow for some flexibility)
      const currentDateObj = new Date(currentDate)
      const nextDateObj = new Date(nextDate)
      const daysDiff =
        Math.abs(nextDateObj.getTime() - currentDateObj.getTime()) / (1000 * 60 * 60 * 24)

      if (daysDiff <= 2) {
        const currentStates = dailyStates.get(currentDate)!
        const nextStates = dailyStates.get(nextDate)!

        // Calculate hourly matches (same state at same hour)
        const hourlyMatches = currentStates.map((state, hour) =>
          state === nextStates[hour] ? 1 : 0
        )
        consecutiveMatches.push(hourlyMatches)
      }
    }

    if (consecutiveMatches.length === 0) {
      return null
    }

    // Calculate average probability across all hours and all consecutive day pairs
    const totalMatches = consecutiveMatches.reduce(
      (sum, matches) => sum + matches.reduce((hourSum, match) => hourSum + match, 0),
      0
    )
    const totalComparisons = consecutiveMatches.length * 24
    const sri = (totalMatches / totalComparisons) * 100

    return Math.round(sri * 100) / 100 // Round to 2 decimal places
  }

  /**
   * Calculate bedtime consistency by calculating the average of days where the athlete
   * went to bed between 13h and 23h59.
   *
   * @param last7days Array of sleep data for the last 7 days
   * @returns Bedtime consistency score (0-100, higher = more consistent) or null if insufficient data
   */
  private handleBedtimeConsistencyData(last7days: DayScoreData[]): {
    bedtimeConsistencyScore: number | null
  } {
    if (last7days.length < 2) {
      return { bedtimeConsistencyScore: null }
    }

    // Filter days with valid sleep data (bedtime and wake up times)
    const validSleepDays = last7days.filter((day) => {
      const sleep = day.sleep
      return sleep.bedtimeDate && sleep.wakeUpDate
    })

    if (validSleepDays.length < 2) {
      return { bedtimeConsistencyScore: null }
    }

    let daysWithGoodBedtime = 0

    for (const day of validSleepDays) {
      const sleep = day.sleep

      if (!sleep.bedtimeDate) continue

      const { bedtimeDate: bedtime } = sleep

      // Check if bedtime is between 13h and 23h59
      const bedtimeHour = bedtime.hour
      const bedtimeMinute = bedtime.minute

      const totalMinutes = bedtimeHour * 60 + bedtimeMinute
      const minMinutes = 13 * 60
      const maxMinutes = 23 * 60 + 59

      if (totalMinutes >= minMinutes && totalMinutes <= maxMinutes) {
        daysWithGoodBedtime++
      }
    }

    const bedtimeConsistency = (daysWithGoodBedtime / validSleepDays.length) * 100
    const bedtimeConsistencyList: number[] = []

    const tresholds = [90, 70, 50, 30]
    for (const threshold of tresholds) {
      bedtimeConsistencyList.push(bedtimeConsistency >= threshold ? 1 : 0)
    }
    const bedtimeConsistencyScore =
      (bedtimeConsistencyList.reduce((sum, val) => sum + val, 0) / bedtimeConsistencyList.length) *
      100

    return {
      bedtimeConsistencyScore: Math.round(bedtimeConsistencyScore * 100) / 100,
    }
  }

  public calculateInjurySleepScore({
    qualityScore,
    efficiencyScore,
    quantityScore,
    consistencyScore,
    bedtimeConsistencyScore,
    sleepDebtScore,
  }: {
    qualityScore: number | null
    efficiencyScore: number | null
    quantityScore: number | null
    consistencyScore: number | null
    bedtimeConsistencyScore: number | null
    sleepDebtScore: number | null
  }): number | null {
    const weights = {
      qualityScore: 0.125, // Sleep Quality (Mauna)
      efficiencyScore: 0.125, // Sleep efficiency (Whoop)
      quantityScore: 0.25, // Quantité de sommeil
      consistencyScore: 0.125, // Consistency
      bedtimeConsistencyScore: 0.125, // Bedtime Consistency
      sleepDebtScore: 0.25, // Sleep Debt
    }

    const scores = {
      qualityScore,
      efficiencyScore,
      quantityScore,
      consistencyScore,
      bedtimeConsistencyScore,
      sleepDebtScore,
    }

    if (efficiencyScore === null) {
      weights.qualityScore = 0.25
    }

    if (qualityScore === null) {
      weights.efficiencyScore = 0.25
    }

    // Filter out null values
    const validScores: Record<string, number> = {}
    for (const [key, value] of Object.entries(scores)) {
      if (value !== null && value !== undefined) {
        validScores[key] = value
      }
    }

    if (Object.keys(validScores).length === 0) {
      return null
    }

    // Get corresponding weights and normalize them
    const validWeights: Record<string, number> = {}
    let weightSum = 0
    for (const key of Object.keys(validScores)) {
      validWeights[key] = weights[key as keyof typeof weights]
      weightSum += validWeights[key]
    }

    // Calculate weighted sum with normalized weights
    return Object.entries(validScores).reduce(
      (sum, [key, value]) => sum + value * (validWeights[key] / weightSum),
      0
    )
  }
}
