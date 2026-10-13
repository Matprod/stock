import { MEAL_SUMMARY_NUTRIENT_KEYS } from '#contracts/nutrition'
import DayService from '#services/day_service'
import HealthPain from '#models_pg/health_pain'
import SportActivityPain from '#models_pg/sport_activity_pain'
import type {
  ActivityEvolutionActivityStats,
  ActivityEvolutionGraphPoint,
  ActivityEvolutionResponse,
  HealthDayInsight,
  HealthEvolutionResponse,
  NutritionEvolutionGraphPoint,
  NutritionEvolutionResponse,
  NutritionEvolutionTotalResume,
  PainInsightPoint,
  PainZoneInfo,
  SleepEvolutionGraphPoint,
  SleepEvolutionResponse,
} from '#contracts/mobile/evolution'
import {
  avg,
  avgMinutesToTime,
  formatHoursToHhMm,
  formatMinutesToHuman,
  formatTotalHoursToHhMm,
} from '#utils/time'

export class EvolutionService {
  private dayService: DayService

  constructor() {
    this.dayService = new DayService()
  }

  public async getSleepEvolution(
    athleteId: string,
    from: Date,
    to: Date
  ): Promise<SleepEvolutionResponse> {
    const days = await this.dayService.getDaysByDateRange(athleteId, from, to, ['sleeps'], {
      orderBy: 'asc',
    })

    const daysByDate = new Map<string, (typeof days)[number]>()
    for (const day of days) {
      const dateKey = day.dateOfDay?.toISODate()
      if (dateKey) {
        daysByDate.set(dateKey, day)
      }
    }

    const graphData: SleepEvolutionGraphPoint[] = []

    const qualityValues: number[] = []
    const sleepDurations: number[] = []
    const timeInBedDurations: number[] = []
    const bedtimeMinutes: number[] = []
    const wakeupMinutes: number[] = []
    const efficiencyValues: number[] = []
    const consistencyValues: number[] = []

    const current = from ? new Date(from) : null
    const end = to ? new Date(to) : null

    if (current && end) {
      while (current <= end) {
        const isoDate = current.toISOString().slice(0, 10)
        const day = daysByDate.get(isoDate)

        const sleep = day?.sleeps?.[0]

        let sleepQuality: number | null = null
        let sleepTime: number | null = null

        if (sleep) {
          if (typeof sleep.qualityRating === 'number') {
            qualityValues.push(sleep.qualityRating)
            sleepQuality = sleep.qualityRating
          }

          const durationHours = sleep.durationHours
          if (typeof durationHours === 'number') {
            sleepDurations.push(durationHours)
            sleepTime = Math.round(durationHours * 10) / 10
          }

          if (sleep.totalInBedTimeMilli !== null && sleep.totalInBedTimeMilli !== undefined) {
            const hoursInBed = sleep.totalInBedTimeMilli / (1000 * 60 * 60)
            timeInBedDurations.push(hoursInBed)
          }

          if (sleep.bedtimeDate) {
            const bedtime = sleep.bedtimeDate
            const minutes = bedtime.hour * 60 + bedtime.minute
            bedtimeMinutes.push(minutes)
          }

          if (sleep.wakeUpDate) {
            const wakeup = sleep.wakeUpDate
            const minutes = wakeup.hour * 60 + wakeup.minute
            wakeupMinutes.push(minutes)
          }

          if (
            typeof sleep.sleepEfficiencyPercentage === 'number' &&
            !Number.isNaN(sleep.sleepEfficiencyPercentage)
          ) {
            efficiencyValues.push(sleep.sleepEfficiencyPercentage)
          }
        }

        if (sleep) {
          const consistency = sleep.sleepConsistencyPercentage
          if (typeof consistency === 'number' && !Number.isNaN(consistency)) {
            consistencyValues.push(consistency)
          }
        }

        graphData.push({
          date: isoDate,
          sleepQuality,
          sleepTime,
        })

        current.setDate(current.getDate() + 1)
      }
    }

    const avgQualityOfSleep = avg(qualityValues)
    const avgSleepHours = avg(sleepDurations)
    const totalSleepHours = sleepDurations.length
      ? sleepDurations.reduce((sum, v) => sum + v, 0)
      : null
    const avgTimeInBedHours = avg(timeInBedDurations)
    const avgEfficiency = avg(efficiencyValues)
    const avgConsistency = avg(consistencyValues)

    const response: SleepEvolutionResponse = {
      avgQualityOfSleep,
      avgSleepTime: formatHoursToHhMm(avgSleepHours),
      totalSleepTime: formatTotalHoursToHhMm(totalSleepHours),
      avgBedtime: avgMinutesToTime(bedtimeMinutes),
      avgWakeupTime: avgMinutesToTime(wakeupMinutes),
      avgTimeInBed: formatHoursToHhMm(avgTimeInBedHours),
      graphData,
    }

    if (avgEfficiency !== null) {
      response.avgEfficiency = avgEfficiency
    }

    if (avgConsistency !== null) {
      response.avgConsistency = avgConsistency
    }

    return response
  }

  public async getHealthEvolution(
    athleteId: string,
    from: Date,
    to: Date
  ): Promise<HealthEvolutionResponse> {
    const days = await this.dayService.getDaysByDateRange(athleteId, from, to, ['health'], {
      orderBy: 'asc',
    })

    const daysByDate = new Map<string, (typeof days)[number]>()
    for (const day of days) {
      const dateKey = day.dateOfDay?.toISODate()
      if (dateKey) {
        daysByDate.set(dateKey, day)
      }
    }

    const daysInsights: HealthDayInsight[] = []
    const moodValues: number[] = []
    const energyValues: number[] = []
    const stressValues: number[] = []

    const dates: string[] = []
    const current = from ? new Date(from) : null
    const end = to ? new Date(to) : null

    if (current && end) {
      while (current <= end) {
        const isoDate = current.toISOString().slice(0, 10)
        dates.push(isoDate)

        const day = daysByDate.get(isoDate)
        const health = day?.health

        let mood: number | null = null
        let energy: number | null = null
        let stress: number | null = null

        if (health) {
          if (typeof health.moodRating === 'number' && !Number.isNaN(health.moodRating)) {
            moodValues.push(health.moodRating)
            mood = health.moodRating
          }

          if (typeof health.energyRating === 'number' && !Number.isNaN(health.energyRating)) {
            energyValues.push(health.energyRating)
            energy = health.energyRating
          }

          if (typeof health.stressRating === 'number' && !Number.isNaN(health.stressRating)) {
            stressValues.push(health.stressRating)
            stress = health.stressRating
          }
        }

        daysInsights.push({
          date: isoDate,
          mood,
          energy,
          stress,
        })

        current.setDate(current.getDate() + 1)
      }
    }

    const [healthPains, sportPains] = await Promise.all([
      HealthPain.query()
        .whereHas('health', (healthQuery) => {
          healthQuery.whereHas('day', (dayQuery) => {
            dayQuery.where('athleteId', athleteId).whereBetween('dateOfDay', [from, to])
          })
        })
        .preload('location', (locationQuery) => {
          locationQuery.preload('zone')
        })
        .preload('health', (healthQuery) => {
          healthQuery.preload('day')
        }),
      SportActivityPain.query()
        .whereHas('sportActivity', (sportActivityQuery) => {
          sportActivityQuery.whereHas('day', (dayQuery) => {
            dayQuery.where('athleteId', athleteId).whereBetween('dateOfDay', [from, to])
          })
        })
        .preload('location', (locationQuery) => {
          locationQuery.preload('zone')
        })
        .preload('sportActivity', (sportActivityQuery) => {
          sportActivityQuery.preload('day')
        }),
    ])

    const healthByLocationAndDate = new Map<string, Map<string, HealthPain>>()
    const sportByLocationAndDate = new Map<string, Map<string, SportActivityPain>>()
    const healthLocationMeta = new Map<
      string,
      {
        name: string
        zoneName: string
        zoneSide: string | null
      }
    >()
    const sportLocationMeta = new Map<
      string,
      {
        name: string
        zoneName: string
        zoneSide: string | null
      }
    >()

    for (const pain of healthPains) {
      const health = pain.health
      const day = health?.day
      const location = pain.location
      const zone = location?.zone

      const isoDate = day?.dateOfDay?.toISODate()
      const locationId = location?.id

      if (!isoDate || !locationId) continue

      if (!healthByLocationAndDate.has(locationId)) {
        healthByLocationAndDate.set(locationId, new Map())
      }
      healthByLocationAndDate.get(locationId)!.set(isoDate, pain)

      if (!healthLocationMeta.has(locationId) && location) {
        const name = location.name ?? 'unknown'
        healthLocationMeta.set(locationId, {
          name,
          zoneName: zone?.name ?? 'unknown',
          zoneSide: zone?.side ?? null,
        })
      }
    }

    for (const pain of sportPains) {
      const sportActivity = pain.sportActivity
      const day = sportActivity?.day
      const location = pain.location
      const zone = location?.zone

      const isoDate = day?.dateOfDay?.toISODate()
      const locationId = location?.id

      if (!isoDate || !locationId) continue

      if (!sportByLocationAndDate.has(locationId)) {
        sportByLocationAndDate.set(locationId, new Map())
      }
      sportByLocationAndDate.get(locationId)!.set(isoDate, pain)

      if (!sportLocationMeta.has(locationId) && location) {
        const name = location.name ?? 'unknown'
        sportLocationMeta.set(locationId, {
          name,
          zoneName: zone?.name ?? 'unknown',
          zoneSide: zone?.side ?? null,
        })
      }
    }

    const painInsights: Record<string, PainInsightPoint[]> = {}
    const painHealth: PainZoneInfo[] = []
    const painSport: PainZoneInfo[] = []

    for (const [, meta] of healthLocationMeta.entries()) {
      painHealth.push({
        zoneName: meta.zoneName,
        zoneSide: meta.zoneSide,
        name: meta.name,
      })
    }

    for (const [, meta] of sportLocationMeta.entries()) {
      painSport.push({
        zoneName: meta.zoneName,
        zoneSide: meta.zoneSide,
        name: meta.name,
      })
    }

    const allLocationIds = new Set<string>([
      ...healthByLocationAndDate.keys(),
      ...sportByLocationAndDate.keys(),
    ])

    for (const locationId of allLocationIds) {
      const healthMeta = healthLocationMeta.get(locationId)
      const sportMeta = sportLocationMeta.get(locationId)
      const meta = healthMeta ?? sportMeta

      if (!meta) continue

      const series: PainInsightPoint[] = []

      for (const date of dates) {
        const healthPain = healthByLocationAndDate.get(locationId)?.get(date) ?? null
        const sportPain = sportByLocationAndDate.get(locationId)?.get(date) ?? null

        series.push({
          date,
          rating: healthPain ? healthPain.rating : null,
          type: 'health',
          id: null,
        })

        series.push({
          date,
          rating: sportPain ? sportPain.rating : null,
          type: 'sport',
          id: sportPain?.sportActivityId ?? null,
        })
      }

      painInsights[meta.name] = series
    }

    const response: HealthEvolutionResponse = {
      avgEnergy: avg(energyValues),
      avgMood: avg(moodValues),
      avgStress: avg(stressValues),
      daysInsights: daysInsights,
      painInsights: painInsights,
      painHealth: painHealth,
      painSport: painSport,
    }

    return response
  }

  public async getActivityEvolution(
    athleteId: string,
    from: Date,
    to: Date
  ): Promise<ActivityEvolutionResponse> {
    const days = await this.dayService.getDaysByDateRange(
      athleteId,
      from,
      to,
      ['sportActivities'],
      { orderBy: 'asc' }
    )

    const daysByDate = new Map<string, (typeof days)[number]>()
    for (const day of days) {
      const dateKey = day.dateOfDay?.toISODate()
      if (dateKey) {
        daysByDate.set(dateKey, day)
      }
    }

    const graph: ActivityEvolutionGraphPoint[] = []

    type Aggregation = {
      numActivities: number
      totalDistance: number
      totalDurationMinutes: number
      totalElevation: number
      speedValues: number[]
      totalTrainingLoad: number
      positiveTrainingLoadSum: number
      positiveTrainingLoadCount: number
    }

    const totalAgg: Aggregation = {
      numActivities: 0,
      totalDistance: 0,
      totalDurationMinutes: 0,
      totalElevation: 0,
      speedValues: [],
      totalTrainingLoad: 0,
      positiveTrainingLoadSum: 0,
      positiveTrainingLoadCount: 0,
    }

    const byActivityType = new Map<string, Aggregation>()

    const current = from ? new Date(from) : null
    const end = to ? new Date(to) : null

    if (current && end) {
      while (current <= end) {
        const isoDate = current.toISOString().slice(0, 10)
        const day = daysByDate.get(isoDate)
        const activities = day?.sportActivities ?? []

        const dayData: ActivityEvolutionGraphPoint['data'] = []

        for (const activity of activities) {
          const sport = activity.sport
          const activityTypeName = sport?.name || activity.activityName || 'Unknown'

          const trainingLoad = activity.trainingLoad ?? 0
          const distance = activity.distance ?? 0
          const elevation = activity.elevation ?? 0
          const durationMinutes = activity.durationMinutes
          const speed = activity.speed ?? null

          dayData.push({
            activityType: activityTypeName,
            activityId: activity.id,
            trainingLoad,
            distance,
          })

          const mutateAggregation = (agg: Aggregation) => {
            agg.numActivities += 1
            agg.totalDistance += distance
            agg.totalDurationMinutes += durationMinutes
            agg.totalElevation += elevation
            agg.totalTrainingLoad += trainingLoad
            if (trainingLoad > 0) {
              agg.positiveTrainingLoadSum += trainingLoad
              agg.positiveTrainingLoadCount += 1
            }
            if (speed !== null && Number.isFinite(speed)) {
              agg.speedValues.push(speed)
            }
          }

          mutateAggregation(totalAgg)

          const existingAgg = byActivityType.get(activityTypeName) ?? {
            numActivities: 0,
            totalDistance: 0,
            totalDurationMinutes: 0,
            totalElevation: 0,
            speedValues: [],
            totalTrainingLoad: 0,
            positiveTrainingLoadSum: 0,
            positiveTrainingLoadCount: 0,
          }

          mutateAggregation(existingAgg)
          byActivityType.set(activityTypeName, existingAgg)
        }

        graph.push({
          dateOfDay: isoDate,
          data: dayData,
        })

        current.setDate(current.getDate() + 1)
      }
    }

    const activitiesStats: Record<string, ActivityEvolutionActivityStats> = {}
    const totalNumActivities = totalAgg.numActivities

    for (const [activityTypeName, agg] of byActivityType.entries()) {
      const avgSpeed =
        agg.speedValues.length > 0
          ? agg.speedValues.reduce((sum, v) => sum + v, 0) / agg.speedValues.length
          : null

      const averageTrainingLoad =
        agg.positiveTrainingLoadCount > 0
          ? agg.positiveTrainingLoadSum / agg.positiveTrainingLoadCount
          : 0

      const proportion = totalNumActivities > 0 ? agg.numActivities / totalNumActivities : 0

      activitiesStats[activityTypeName] = {
        numActivities: agg.numActivities,
        totalDistance: agg.totalDistance,
        totalDuration: formatMinutesToHuman(agg.totalDurationMinutes),
        totalElevation: agg.totalElevation,
        avgSpeed,
        totalTrainingLoad: agg.totalTrainingLoad,
        averageTrainingLoad,
        proportion,
      }
    }

    const positiveTotalAverageTrainingLoad =
      totalAgg.positiveTrainingLoadCount > 0
        ? totalAgg.positiveTrainingLoadSum / totalAgg.positiveTrainingLoadCount
        : 0

    const pieChart: Record<string, number> = {}
    for (const [activityTypeName, agg] of byActivityType.entries()) {
      const key = activityTypeName.toLowerCase()
      pieChart[key] = totalNumActivities > 0 ? agg.numActivities / totalNumActivities : 0
    }

    const response: ActivityEvolutionResponse = {
      total: {
        numActivities: totalAgg.numActivities,
        totalDuration: formatMinutesToHuman(totalAgg.totalDurationMinutes),
        totalTrainingLoad: totalAgg.totalTrainingLoad,
        averageTrainingLoad: positiveTotalAverageTrainingLoad,
        graph,
      },
      activities: activitiesStats,
      pieChart,
    }

    return response
  }

  public async getNutritionEvolution(
    athleteId: string,
    from: Date,
    to: Date
  ): Promise<NutritionEvolutionResponse> {
    const days = await this.dayService.getDaysByDateRange(
      athleteId,
      from,
      to,
      ['nutrition', 'sportActivitiesWithFoodIntakes'],
      { orderBy: 'asc' }
    )

    const daysByDate = new Map<string, (typeof days)[number]>()
    for (const day of days) {
      const dateKey = day.dateOfDay?.toISODate()
      if (dateKey) {
        daysByDate.set(dateKey, day)
      }
    }

    function getNutrientValue(meal: object | null | undefined, field: string): number {
      if (!meal) return 0
      const record = meal as Record<string, unknown>
      const v = record[field]
      if (v === null || v === undefined) return 0
      const num = Number(v)
      return Number.isFinite(num) ? num : 0
    }

    const computeDayTotals = (day: (typeof days)[number]) => {
      const totals: Record<string, number> = {}
      for (const key of MEAL_SUMMARY_NUTRIENT_KEYS) {
        totals[key] = 0
      }

      for (const nutrition of day.nutrition ?? []) {
        const portion = nutrition.portion ?? 0
        const quantity = nutrition.quantity ?? 0
        const factor = (portion * quantity) / 100

        const mealData = nutrition.aliment ?? nutrition.llmAliment ?? null
        if (mealData) {
          for (const key of MEAL_SUMMARY_NUTRIENT_KEYS) {
            totals[key] += getNutrientValue(mealData, key) * factor
          }
        }

        if (nutrition.recipe?.recipeAliments) {
          for (const recipeAliment of nutrition.recipe.recipeAliments) {
            const rmPortion = recipeAliment.portion ?? 0
            const rmQuantity = recipeAliment.quantity ?? 0
            const rmFactor = (rmPortion * rmQuantity) / 100
            const meal = recipeAliment.meal ?? null
            if (meal) {
              for (const key of MEAL_SUMMARY_NUTRIENT_KEYS) {
                totals[key] += getNutrientValue(meal, key) * rmFactor
              }
            }
          }
        }
      }

      for (const activity of day.sportActivities ?? []) {
        for (const foodIntake of activity.activityFoodIntakes ?? []) {
          const food = foodIntake.aliment ?? null
          if (!food) continue
          const portion = foodIntake.portion ?? 0
          const quantity = foodIntake.quantity ?? 0
          const factor = (portion * quantity) / 100
          for (const key of MEAL_SUMMARY_NUTRIENT_KEYS) {
            totals[key] += getNutrientValue(food, key) * factor
          }
        }
      }

      return totals
    }

    const graphData: NutritionEvolutionGraphPoint[] = []
    let daysWithFood = 0
    const totalMacronutrientsSum = { proteinsG: 0, carbohydrateG: 0, fatG: 0 }
    const totalResumeAcc: Record<string, number> = {}
    for (const key of MEAL_SUMMARY_NUTRIENT_KEYS) {
      totalResumeAcc[key] = 0
    }
    const current = new Date(from)
    const end = new Date(to)

    while (current <= end) {
      const isoDate = current.toISOString().slice(0, 10)
      const day = daysByDate.get(isoDate)
      const dayTotals = day ? computeDayTotals(day) : null

      const proteinsG = dayTotals?.proteinsG ?? 0
      const carbohydrateG = dayTotals?.carbohydrateG ?? 0
      const fatG = dayTotals?.fatG ?? 0
      const totalMacronutrients = proteinsG + carbohydrateG + fatG

      if (totalMacronutrients > 0) {
        daysWithFood += 1
        const carbohydrates = (carbohydrateG / totalMacronutrients) * 100
        const proteins = (proteinsG / totalMacronutrients) * 100
        const fats = (fatG / totalMacronutrients) * 100
        graphData.push({
          date: isoDate,
          carbohydrates,
          proteins,
          fats,
        })
        totalMacronutrientsSum.proteinsG += proteins
        totalMacronutrientsSum.carbohydrateG += carbohydrates
        totalMacronutrientsSum.fatG += fats
      } else {
        graphData.push({
          date: isoDate,
          carbohydrates: 0,
          proteins: 0,
          fats: 0,
        })
      }

      if (dayTotals) {
        for (const key of MEAL_SUMMARY_NUTRIENT_KEYS) {
          totalResumeAcc[key] += dayTotals[key]
        }
      }

      current.setDate(current.getDate() + 1)
    }

    const totalMacrosPercentage = {
      proteinsG: daysWithFood > 0 ? totalMacronutrientsSum.proteinsG / daysWithFood : 0,
      carbohydrateG: daysWithFood > 0 ? totalMacronutrientsSum.carbohydrateG / daysWithFood : 0,
      fatG: daysWithFood > 0 ? totalMacronutrientsSum.fatG / daysWithFood : 0,
    }

    const totalResume: NutritionEvolutionTotalResume = {
      energyKcal: totalResumeAcc.energyKcal ?? 0,
      proteinsG: totalResumeAcc.proteinsG ?? 0,
      carbohydrateG: totalResumeAcc.carbohydrateG ?? 0,
      fatG: totalResumeAcc.fatG ?? 0,
      sugarsG: totalResumeAcc.sugarsG ?? 0,
      fibresG: totalResumeAcc.fibresG ?? 0,
      fructoseG: totalResumeAcc.fructoseG ?? 0,
      cholesterolMg: totalResumeAcc.cholesterolMg ?? 0,
      sodiumMg: totalResumeAcc.sodiumMg ?? 0,
      calciumMg: totalResumeAcc.calciumMg ?? 0,
      glucoseG: totalResumeAcc.glucoseG ?? 0,
      lactoseG: totalResumeAcc.lactoseG ?? 0,
      maltoseG: totalResumeAcc.maltoseG ?? 0,
      sucroseG: totalResumeAcc.sucroseG ?? 0,
      magnesiumMg: totalResumeAcc.magnesiumMg ?? 0,
      potassiumMg: totalResumeAcc.potassiumMg ?? 0,
      zincMg: totalResumeAcc.zincMg ?? 0,
      ironMg: totalResumeAcc.ironMg ?? 0,
      vitaminDMicrog: totalResumeAcc.vitaminDMicrog ?? 0,
      vitaminCMg: totalResumeAcc.vitaminCMg ?? 0,
      vitaminEMg: totalResumeAcc.vitaminEMg ?? 0,
      vitaminB1Mg: totalResumeAcc.vitaminB1Mg ?? 0,
      vitaminB2Mg: totalResumeAcc.vitaminB2Mg ?? 0,
      vitaminB3Mg: totalResumeAcc.vitaminB3Mg ?? 0,
      vitaminB5Mg: totalResumeAcc.vitaminB5Mg ?? 0,
      vitaminB6Mg: totalResumeAcc.vitaminB6Mg ?? 0,
      vitaminB9Microg: totalResumeAcc.vitaminB9Microg ?? 0,
      vitaminB12Microg: totalResumeAcc.vitaminB12Microg ?? 0,
      chlorideMg: totalResumeAcc.chlorideMg ?? 0,
      totalVitaminBMg: 0,
    }

    return {
      graphData,
      totalMacrosPercentage,
      totalResume,
    }
  }
}
