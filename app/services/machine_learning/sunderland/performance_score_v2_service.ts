import { DateTime } from 'luxon'
import axios from 'axios'
import env from '#start/env'
import Athlete from '#models_pg/athlete'
import Day from '#models_pg/day'
import Season from '#models_pg/season'
import SportActivity from '#models_pg/sport_activity'
import Injury from '#models_pg/injury'
import FeatureImportance from '#models_pg/feature_importance'
import Insight from '#models_pg/insight'
import AthleteService from '#services/athlete_service'
import { MetricService } from '#services/metric_service'
import { MetricDomain } from '#contracts/metric'
import { ewmaScalar, standardDeviation } from '../../../utils/statistics.js'
import { shouldExcludeDateFromEWMA } from '../../../utils/injury.js'
import type { ModelAttributes } from '@adonisjs/lucid/types/model'
import type {
  FeatureImportanceItem,
  PerformanceScoreV2Data,
  PerformanceScoreV2Payload,
  PerformanceScoreV2Result,
} from '#contracts/sunderland'

const PERFORMANCE_SCORE_V2_URL =
  'https://ro0g9olbvl.execute-api.eu-west-3.amazonaws.com/predict_performance/v2'

type RatioSeries = {
  dynamic: number[]
  running: number[]
}

type SeriesStats = {
  ewma7: number
  ewma28: number
  mean7: number
  std7: number
  monotony: number
  strain: number
}

export default class PerformanceScoreV2Service {
  private readonly dayMetricService: MetricService
  private readonly periodMetricService: MetricService
  private readonly athleteService: AthleteService

  constructor() {
    this.dayMetricService = new MetricService(MetricDomain.DAY)
    this.periodMetricService = new MetricService(MetricDomain.PERIOD)
    this.athleteService = new AthleteService()
  }

  public async predictAndStoreScoreForNextDay(
    athleteId: string,
    targetDate: DateTime
  ): Promise<number | null> {
    const predictionDate = targetDate.plus({ days: 1 })
    const payloadData = await this.buildPayloadData(athleteId, predictionDate)
    if (!payloadData) {
      return null
    }

    const payload: PerformanceScoreV2Payload = { data: [payloadData] }
    const results = await this.calculatePerformanceScoreV2(payload)
    const scoreOverall = results.result[0]?.score_overall
    if (typeof scoreOverall !== 'number' || Number.isNaN(scoreOverall)) {
      console.warn(
        `No valid score_overall returned for athlete ${athleteId} on ${predictionDate.toFormat('yyyy-MM-dd')}`
      )
      return null
    }

    const performanceScore = Math.round(scoreOverall)
    const dayPlusOne = await this.athleteService.getOrCreateDay(athleteId, predictionDate)
    await dayPlusOne.merge({ performanceScore }).save()
    await this.storeFeatureImportancesForDay(
      dayPlusOne.id,
      results.result[0]?.feature_importances ?? [],
      results.result[0]?.optimal_features ?? []
    )

    return performanceScore
  }

  private async calculatePerformanceScoreV2(
    payload: PerformanceScoreV2Payload
  ): Promise<PerformanceScoreV2Result> {
    const token = env.get('MACHINE_LEARNING_API_TOKEN')
    const response = await axios.post<PerformanceScoreV2Result>(PERFORMANCE_SCORE_V2_URL, payload, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    })
    return response.data
  }

  private async buildPayloadData(
    athleteId: string,
    predictionDate: DateTime
  ): Promise<PerformanceScoreV2Data | null> {
    const athlete = await Athlete.query()
      .where('id', athleteId)
      .preload('playerPosition')
      .preload('club', (clubQuery) => {
        clubQuery.preload('seasons', (seasonsQuery) => {
          seasonsQuery.orderBy('startDate', 'desc')
        })
      })
      .first()

    if (!athlete) {
      return null
    }

    const lookbackStart = predictionDate.minus({ days: 28 })
    const lookbackEnd = predictionDate.minus({ days: 1 })
    const allInjuries = await Injury.query()
      .where('athleteId', athleteId)
      .whereNotNull('dateOfInjury')
      .orderBy('dateOfInjury', 'desc')

    const days = await Day.query()
      .where('athleteId', athleteId)
      .whereBetween('dateOfDay', [lookbackStart.toJSDate(), lookbackEnd.toJSDate()])
      .preload('athlete')
      .preload('metricValues', (query) => {
        query.preload('metric')
      })
      .preload('health')
      .preload('sleeps')
      .preload('bodymetricsHistories')
      .orderBy('dateOfDay', 'asc')

    const activities = await SportActivity.query()
      .whereHas('day', (query) => {
        query
          .where('athleteId', athleteId)
          .whereBetween('dateOfDay', [lookbackStart.toJSDate(), lookbackEnd.toJSDate()])
      })
      .preload('periods', (periodQuery) => {
        periodQuery.preload('metricValues', (metricQuery) => {
          metricQuery.preload('metric')
        })
      })
      .preload('day')

    const dayByDate = new Map<string, Day>()
    for (const day of days) {
      if (day.dateOfDay) {
        dayByDate.set(day.dateOfDay.toFormat('yyyy-MM-dd'), day)
      }
    }

    const activitiesByDate = new Map<string, SportActivity[]>()
    for (const activity of activities) {
      const dateOfDay = activity.day?.dateOfDay
      if (!dateOfDay) {
        continue
      }
      const key = dateOfDay.toFormat('yyyy-MM-dd')
      const bucket = activitiesByDate.get(key) ?? []
      bucket.push(activity)
      activitiesByDate.set(key, bucket)
    }

    const tlNmF1 = this.buildMetricSeries('TL_NM_F1', predictionDate, 28, dayByDate)
    const tlNmF2 = this.buildMetricSeries('TL_NM_F2', predictionDate, 28, dayByDate)
    const tlVolumeF1 = this.buildMetricSeries('TL_volume_F1', predictionDate, 28, dayByDate)
    const tlVolumeF2 = this.buildMetricSeries('TL_volume_F2', predictionDate, 28, dayByDate)
    const tlHiF1 = this.buildMetricSeries('TL_HI_F1', predictionDate, 28, dayByDate)
    const tlHiF2 = this.buildMetricSeries('TL_HI_F2', predictionDate, 28, dayByDate)
    const tlHiF3 = this.buildMetricSeries('TL_HI_F3', predictionDate, 28, dayByDate)
    const days7d = days.filter(
      (day) =>
        day.dateOfDay &&
        day.dateOfDay >= predictionDate.minus({ days: 7 }) &&
        day.dateOfDay < predictionDate
    )
    const fmpRatios = this.buildFmpRatioSeries(predictionDate, activitiesByDate)

    const tlNmF1Stats = this.computeSeriesStats(tlNmF1)
    const tlNmF2Stats = this.computeSeriesStats(tlNmF2)
    const tlVolumeF1Stats = this.computeSeriesStats(tlVolumeF1)
    const tlVolumeF2Stats = this.computeSeriesStats(tlVolumeF2)
    const tlHiF1Stats = this.computeSeriesStats(tlHiF1)
    const tlHiF2Stats = this.computeSeriesStats(tlHiF2)
    const tlHiF3Stats = this.computeSeriesStats(tlHiF3)
    const dynamicRatioStats = this.computeSeriesStats(fmpRatios.dynamic)
    const runningRatioStats = this.computeSeriesStats(fmpRatios.running)

    const ewmaSleepQuality = this.computeSubjectiveEWMA(days7d, 'Sleep quality', allInjuries)
    const ewmaEnergy = this.computeSubjectiveEWMA(days7d, 'Energy', allInjuries)
    const ewmaBodySoreness = this.computeSubjectiveEWMA(days7d, 'Body Soreness', allInjuries)

    const acwrExpTlHiF3 =
      tlHiF3Stats.ewma7 === 0 && tlHiF3Stats.ewma28 === 0
        ? 1
        : tlHiF3Stats.ewma28 > 0
          ? tlHiF3Stats.ewma7 / tlHiF3Stats.ewma28
          : 0

    const contextMetrics = this.calculateContextMetrics(predictionDate, activitiesByDate)
    const bodyWeight = this.getLatestBodyWeight(predictionDate, dayByDate)
    const seasonIdentifier = this.getSeasonIdentifier(athlete, predictionDate)

    return {
      'player_position': athlete.playerPosition?.name ?? '',
      'season': seasonIdentifier,
      'Body Weight': bodyWeight,

      'EWMA_7d_fmp_dynamic_high_duration_ratio': dynamicRatioStats.ewma7,
      'mean_7d_fmp_dynamic_high_duration_ratio': dynamicRatioStats.mean7,
      'std_7d_fmp_dynamic_high_duration_ratio': dynamicRatioStats.std7,
      'monotony_fmp_dynamic_high_duration_ratio': dynamicRatioStats.monotony,
      'strain_fmp_dynamic_high_duration_ratio': dynamicRatioStats.strain,

      'EWMA_7d_fmp_running_high_duration_ratio': runningRatioStats.ewma7,
      'mean_7d_fmp_running_high_duration_ratio': runningRatioStats.mean7,
      'std_7d_fmp_running_high_duration_ratio': runningRatioStats.std7,
      'monotony_fmp_running_high_duration_ratio': runningRatioStats.monotony,
      'strain_fmp_running_high_duration_ratio': runningRatioStats.strain,

      'EWMA_7d_TL_NM_F1': tlNmF1Stats.ewma7,
      'mean_7d_TL_NM_F1': tlNmF1Stats.mean7,
      'std_7d_TL_NM_F1': tlNmF1Stats.std7,
      'monotony_TL_NM_F1': tlNmF1Stats.monotony,
      'strain_TL_NM_F1': tlNmF1Stats.strain,

      'EWMA_7d_TL_NM_F2': tlNmF2Stats.ewma7,
      'EWMA_28d_TL_NM_F2': tlNmF2Stats.ewma28,
      'mean_7d_TL_NM_F2': tlNmF2Stats.mean7,
      'std_7d_TL_NM_F2': tlNmF2Stats.std7,
      'monotony_TL_NM_F2': tlNmF2Stats.monotony,
      'strain_TL_NM_F2': tlNmF2Stats.strain,

      'EWMA_28d_TL_volume_F1': tlVolumeF1Stats.ewma28,
      'EWMA_7d_TL_volume_F1': tlVolumeF1Stats.ewma7,
      'mean_7d_TL_volume_F1': tlVolumeF1Stats.mean7,
      'std_7d_TL_volume_F1': tlVolumeF1Stats.std7,
      'monotony_TL_volume_F1': tlVolumeF1Stats.monotony,
      'strain_TL_volume_F1': tlVolumeF1Stats.strain,

      'EWMA_28d_TL_volume_F2': tlVolumeF2Stats.ewma28,
      'EWMA_7d_TL_volume_F2': tlVolumeF2Stats.ewma7,
      'monotony_TL_volume_F2': tlVolumeF2Stats.monotony,
      'strain_TL_volume_F2': tlVolumeF2Stats.strain,

      'EWMA_7d_TL_HI_F1': tlHiF1Stats.ewma7,
      'monotony_TL_HI_F1': tlHiF1Stats.monotony,
      'strain_TL_HI_F1': tlHiF1Stats.strain,

      'EWMA_7d_TL_HI_F2': tlHiF2Stats.ewma7,
      'monotony_TL_HI_F2': tlHiF2Stats.monotony,
      'strain_TL_HI_F2': tlHiF2Stats.strain,

      'EWMA_7d_TL_HI_F3': tlHiF3Stats.ewma7,
      'monotony_TL_HI_F3': tlHiF3Stats.monotony,
      'strain_TL_HI_F3': tlHiF3Stats.strain,
      'ACWR_exp_TL_HI_F3': acwrExpTlHiF3,

      'EWMA_7d_Sleep quality': ewmaSleepQuality,
      'EWMA_7d_Energy': ewmaEnergy,
      'EWMA_7d_Body Soreness': ewmaBodySoreness,

      'games_last_7d': contextMetrics.games_last_7d,
      'HSR_sessions_last_7d': contextMetrics.hsr_sessions_last_7d,
    }
  }

  private getSeasonIdentifier(athlete: Athlete, predictionDate: DateTime): number {
    const season = athlete.club?.seasons?.find(
      (item: Season) =>
        predictionDate.toJSDate() >= item.startDate && predictionDate.toJSDate() <= item.endDate
    )
    if (!season?.name) {
      return predictionDate.year
    }

    const matches = season.name.match(/\d{4}/g)
    if (!matches || matches.length === 0) {
      return predictionDate.year
    }

    return Number(matches[matches.length - 1])
  }

  private getLatestBodyWeight(predictionDate: DateTime, dayByDate: Map<string, Day>): number {
    let cursor = predictionDate.minus({ days: 1 })
    for (let i = 0; i < 28; i++) {
      const day = dayByDate.get(cursor.toFormat('yyyy-MM-dd'))
      if (
        day?.bodymetricsHistories?.[0]?.weight !== null &&
        day?.bodymetricsHistories?.[0]?.weight !== undefined
      ) {
        return day.bodymetricsHistories[0].weight
      }
      if (day?.athlete?.weightKg) {
        return day.athlete.weightKg
      }
      cursor = cursor.minus({ days: 1 })
    }
    return 0
  }

  private buildMetricSeries(
    metricName: string,
    predictionDate: DateTime,
    daysCount: number,
    dayByDate: Map<string, Day>
  ): number[] {
    const values: number[] = []
    const startDate = predictionDate.minus({ days: daysCount })
    for (let i = 0; i < daysCount; i++) {
      const date = startDate.plus({ days: i })
      const day = dayByDate.get(date.toFormat('yyyy-MM-dd'))
      if (!day) {
        values.push(0)
        continue
      }
      const metricMap = this.dayMetricService.extractNumericMetrics(day, [metricName])
      const value = metricMap.get(metricName)
      values.push(value !== undefined && value !== null && !Number.isNaN(value) ? value : 0)
    }
    return values
  }

  private buildFmpRatioSeries(
    predictionDate: DateTime,
    activitiesByDate: Map<string, SportActivity[]>
  ): RatioSeries {
    const dynamic: number[] = []
    const running: number[] = []
    const startDate = predictionDate.minus({ days: 7 })

    for (let i = 0; i < 7; i++) {
      const date = startDate.plus({ days: i })
      const activities = activitiesByDate.get(date.toFormat('yyyy-MM-dd')) ?? []
      let dynamicSum = 0
      let runningSum = 0
      let fieldTimeSum = 0

      for (const activity of activities) {
        for (const period of activity.periods ?? []) {
          const { fmp_dynamic_high_duration, fmp_running_high_duration, field_time } =
            this.periodMetricService.extractNumericMetricsAsObject(period, [
              'fmp_dynamic_high_duration',
              'fmp_running_high_duration',
              'field_time',
            ])
          dynamicSum += fmp_dynamic_high_duration ?? 0
          runningSum += fmp_running_high_duration ?? 0
          fieldTimeSum += field_time ?? 0
        }
      }

      if (fieldTimeSum > 0) {
        dynamic.push(dynamicSum / fieldTimeSum)
        running.push(runningSum / fieldTimeSum)
      } else {
        dynamic.push(0)
        running.push(0)
      }
    }

    return { dynamic, running }
  }

  private computeSeriesStats(series28: number[]): SeriesStats {
    const series7 = series28.slice(Math.max(0, series28.length - 7))
    const mean7 = this.mean(series7)
    const std7 = standardDeviation(series7) ?? 0
    const monotony = std7 > 0 ? mean7 / Math.max(std7, 1e-6) : 0

    return {
      ewma7: this.computeEWMA(series7, 7),
      ewma28: this.computeEWMA(series28, 28),
      mean7,
      std7,
      monotony,
      strain: mean7 * monotony,
    }
  }

  private computeEWMA(values: number[], period: number): number {
    if (values.length === 0) {
      return 0
    }
    const alpha = 2 / (period + 1)
    return ewmaScalar([...values].reverse(), alpha)
  }

  private computeSubjectiveEWMA(
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

      if (value !== null && !Number.isNaN(value)) {
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

  private mean(values: number[]): number {
    if (values.length === 0) {
      return 0
    }
    return values.reduce((sum, value) => sum + value, 0) / values.length
  }

  private calculateContextMetrics(
    predictionDate: DateTime,
    activitiesByDate: Map<string, SportActivity[]>
  ): { games_last_7d: number; hsr_sessions_last_7d: number } {
    const startDate = predictionDate.minus({ days: 7 })
    const hsrActivityIds = new Set<string>()
    let gamesLast7d = 0

    for (let i = 0; i < 7; i++) {
      const date = startDate.plus({ days: i })
      const activities = activitiesByDate.get(date.toFormat('yyyy-MM-dd')) ?? []
      for (const activity of activities) {
        if (activity.gameActivity) {
          gamesLast7d++
        }
        const containsHsr = activity.periods?.some(
          (period) => period.name && period.name.toUpperCase().includes('HSR')
        )
        if (containsHsr || activity.gameActivity) {
          hsrActivityIds.add(activity.id)
        }
      }
    }

    return {
      games_last_7d: gamesLast7d,
      hsr_sessions_last_7d: hsrActivityIds.size,
    }
  }

  private async storeFeatureImportancesForDay(
    dayId: string,
    featureImportances: FeatureImportanceItem[],
    optimalFeatures: Array<{
      feature: string
      type: 'activity' | 'health' | 'sleep'
      value: number | null
    }>
  ): Promise<void> {
    const insights = await Insight.all()
    const insightMap = new Map<string, string>()
    for (const insight of insights) {
      insightMap.set(insight.variableName, insight.id)
    }

    const featureImportancesForDay: Omit<
      ModelAttributes<FeatureImportance>,
      'id' | 'createdAt' | 'updatedAt'
    >[] = featureImportances
      .map((feature) => {
        const insightId = insightMap.get(feature.name)
        if (!insightId) {
          return null
        }
        return {
          dayId,
          type: feature.type,
          category: 'performance' as const,
          contribPct: feature.contrib_pct ?? feature.conrib_pct ?? null,
          value: feature.value ?? 0,
          optimal: feature.optimal,
          shapValue: feature.shap_value,
          insightId,
        }
      })
      .filter((item): item is NonNullable<typeof item> => item !== null)

    const optimalFeatureEntries: Omit<
      ModelAttributes<FeatureImportance>,
      'id' | 'createdAt' | 'updatedAt'
    >[] = optimalFeatures
      .map((feature) => {
        const insightId = insightMap.get(feature.feature)
        if (!insightId) {
          return null
        }
        let finalValue = feature.value
        if (finalValue === null && feature.feature.toLowerCase().includes('std')) {
          finalValue = 0
        }
        return {
          dayId,
          contribPct: null,
          type: feature.type,
          category: 'performance' as const,
          value: finalValue ?? 1000,
          optimal: finalValue ?? 1000,
          shapValue: 0,
          insightId,
        }
      })
      .filter((item): item is NonNullable<typeof item> => item !== null)

    await FeatureImportance.query().where('dayId', dayId).where('category', 'performance').delete()

    const entriesToCreate = [...featureImportancesForDay, ...optimalFeatureEntries]
    if (entriesToCreate.length > 0) {
      await FeatureImportance.createMany(entriesToCreate)
    }
  }
}
