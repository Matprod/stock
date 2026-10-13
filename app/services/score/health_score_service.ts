import { CalculateScoreDataPayload, HealthScores, ScoreList } from '#contracts/score'
import Travel from '#models_pg/travel'
import { DateTime } from 'luxon'
import { ewmaScalar } from '../../utils/statistics.js'

export default class HealthScoreService {
  private readonly N_VALUE = 5
  private readonly ALPHA_VALUE = 2 / (this.N_VALUE + 1)

  async calculateHealthScore(
    data: CalculateScoreDataPayload,
    date: string
  ): Promise<HealthScores | null> {
    const { days } = data
    const sortedDays = [...days].sort((a, b) => a.date.getTime() - b.date.getTime())
    const targetDate = DateTime.fromFormat(date, 'yyyy-MM-dd').toJSDate()

    const last7days = sortedDays.filter((day) => {
      const dayDate = new Date(day.date)
      const diffTime = Math.abs(targetDate.getTime() - dayDate.getTime())
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
      return diffDays <= 6
    })

    const last30days = sortedDays.filter((day) => {
      const dayDate = new Date(day.date)
      const diffTime = Math.abs(targetDate.getTime() - dayDate.getTime())
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
      return diffDays <= 29
    })

    const { rhrValues30Days, hrvValues30Days } = last30days.reduce(
      (acc: { rhrValues30Days: number[]; hrvValues30Days: number[] }, day) => {
        if (day.date.getTime() === targetDate.getTime()) return acc

        const { health } = day

        if (health.rhr !== null) {
          acc.rhrValues30Days.push(health.rhr)
        }
        if (health.hrv !== null) {
          acc.hrvValues30Days.push(health.hrv)
        }

        return acc
      },
      {
        rhrValues30Days: [],
        hrvValues30Days: [],
      }
    )

    const { symptoms7Days, outActiPains7Days, actiPains7Days } = last7days.reduce(
      (
        acc: { symptoms7Days: number[]; outActiPains7Days: number[]; actiPains7Days: number[] },
        day
      ) => {
        const { health } = day
        if (health.maxHealthSymptom !== null) {
          acc.symptoms7Days.push(health.maxHealthSymptom)
        }
        if (health.maxHealthPain !== null) {
          acc.outActiPains7Days.push(health.maxHealthPain)
        }
        if (health.maxActivityPain !== null) {
          acc.actiPains7Days.push(health.maxActivityPain)
        }
        return acc
      },
      {
        symptoms7Days: [],
        outActiPains7Days: [],
        actiPains7Days: [],
      }
    )

    const currentDay = sortedDays.find((day) => day.date.getTime() === targetDate.getTime())

    if (!currentDay) {
      throw new Error(`No data found for date 1 ${date}`)
    }

    const { health, activity } = currentDay

    const {
      energyRating,
      moodRating,
      stressRating,
      hasHealth,
      hasHrv,
      hasRhr,
      hrv,
      rhr,
      maxActivityPain,
      maxHealthPain,
      maxHealthSymptom,
      travels,
      lastEwmaHrv,
      lastEwmaRhr,
    } = health

    const { activities } = activity
    const withActivityPain =
      activities.some((activity) => activity.rpe !== null) || (maxActivityPain ?? 0) > 0

    const withOutActivityPain =
      health.energyRating !== null ||
      health.moodRating !== null ||
      health.stressRating !== null ||
      (maxHealthPain ?? 0) > 0

    const withSymptoms = (maxHealthSymptom ?? 0) > 0

    const scores: HealthScores = {
      ewmaActiPains: null,
      actiDouleurScore: null,
      actiDouleurMax: null,
      ewmaOutactiPains: null,
      outactiDouleurScore: null,
      outactiDouleurMax: null,
      ewmaSymptoms: null,
      symptomsScore: null,
      symptomMax: null,
      energyToday: null,
      energyScore: null,
      avgEnergy: null,
      moodToday: null,
      moodScore: null,
      avgMood: null,
      relaxToday: null,
      relaxScore: null,
      avgRelax: null,
      rhrScore: null,
      hrvScore: null,
      travelFatigue: null,
      travelFatigueScore: null,
      ewmaRhr: null,
      rhrFH: null,
      rhrFB: null,
      ewmaHrv: null,
      hrvFH: null,
      hrvFB: null,
    }

    const { ewmaActiPains, actiDouleurToday } = this.handleActiPainsData(
      actiPains7Days,
      withActivityPain
    )
    scores.ewmaActiPains = ewmaActiPains
    scores.actiDouleurScore = actiDouleurToday
    scores.actiDouleurMax = withActivityPain ? maxActivityPain : null

    const { ewmaOutactiPains, outactiDouleurToday } = this.handleHealthPainsData(
      outActiPains7Days,
      withOutActivityPain
    )
    scores.ewmaOutactiPains = ewmaOutactiPains
    scores.outactiDouleurScore = outactiDouleurToday
    scores.outactiDouleurMax = withOutActivityPain ? maxHealthPain : null

    if (
      (maxActivityPain !== null && maxActivityPain >= 4) ||
      (maxHealthPain !== null && maxHealthPain >= 4)
    ) {
      scores.ewmaActiPains = 4
      scores.actiDouleurScore = 0
      scores.actiDouleurMax = maxActivityPain

      scores.ewmaOutactiPains = 4
      scores.outactiDouleurScore = 0
      scores.outactiDouleurMax = maxHealthPain
    }

    if (maxHealthSymptom !== null && maxHealthSymptom >= 4) {
      scores.ewmaSymptoms = 4
      scores.symptomsScore = 0
      scores.symptomMax = maxHealthSymptom
    } else {
      const { ewmaSymptoms, symptomsToday } = this.handleHealthSymptomsData(
        symptoms7Days,
        withSymptoms
      )
      scores.ewmaSymptoms = ewmaSymptoms
      scores.symptomsScore = symptomsToday
      scores.symptomMax = withSymptoms ? maxHealthSymptom : null
    }

    const { travelFatigue, travelFatigueScore } = this.handleTravelData(travels)
    scores.travelFatigue = travelFatigue
    scores.travelFatigueScore = travelFatigueScore

    if (hasHealth) {
      const energy5Days = sortedDays
        .slice(-5)
        .reduce((sum, day) => sum + (day.health?.energyRating || 0), 0)
      const numDaysEnergy = sortedDays
        .slice(-5)
        .filter((day) => day.health?.energyRating != null).length

      const mood5Days = sortedDays
        .slice(-5)
        .reduce((sum, day) => sum + (day.health?.moodRating || 0), 0)
      const numDaysMood = sortedDays.slice(-5).filter((day) => day.health?.moodRating != null).length

      const stress5Days = sortedDays
        .slice(-5)
        .reduce((sum, day) => sum + (day.health?.stressRating || 0), 0)
      const numDaysStress = sortedDays
        .slice(-5)
        .filter((day) => day.health?.stressRating != null).length

      const { energyScoreToday, energyToday, energyAvg } = this.handleEnergyData(
        energyRating,
        energy5Days,
        numDaysEnergy
      )
      const { moodScoreToday, moodToday, moodAvg } = this.handleMoodData(
        moodRating,
        mood5Days,
        numDaysMood
      )
      const { relaxScoreToday, relaxToday, relaxAvg } = this.handleStressData(
        stressRating,
        stress5Days,
        numDaysStress
      )

      scores.energyScore = energyScoreToday
      scores.energyToday = energyToday
      scores.avgEnergy = energyAvg
      scores.moodScore = moodScoreToday
      scores.moodToday = moodToday
      scores.avgMood = moodAvg
      scores.relaxScore = relaxScoreToday
      scores.relaxToday = relaxToday
      scores.avgRelax = relaxAvg

      if (hasRhr && rhr !== null) {
        const {
          rhr: ewmaRhr,
          rhrScore,
          FH,
          FB,
        } = this.handleRhrData(rhr, rhrValues30Days, lastEwmaRhr)
        scores.ewmaRhr = ewmaRhr
        scores.rhrScore = rhrScore
        scores.rhrFH = FH
        scores.rhrFB = FB
      }

      if (hasHrv && hrv !== null) {
        const {
          hrv: ewmaHrv,
          hrvScore,
          FH,
          FB,
        } = this.handleHrvData(hrv, hrvValues30Days, lastEwmaHrv)
        scores.ewmaHrv = ewmaHrv
        scores.hrvScore = hrvScore
        scores.hrvFH = FH
        scores.hrvFB = FB
      }
    }

    return scores
  }

  private handleEnergyData(
    energyRating: number | null,
    energy5Days: number,
    numDaysEnergy: number
  ) {
    if (!energyRating) {
      return {
        energyToday: null,
        energyAvg: null,
        energyScoreToday: null,
      }
    }

    const energyToday = energyRating
    const energyAvg = energy5Days / numDaysEnergy

    const thresholds = [0.8, 1.8, 2.8, 3.8]
    const score =
      (thresholds.reduce((sum, threshold) => sum + (energyAvg >= threshold ? 1 : 0), 0) * 100) /
      thresholds.length

    return {
      energyToday,
      energyAvg,
      energyScoreToday: score,
    }
  }

  private handleMoodData(moodRating: number | null, mood5Days: number, numDaysMood: number) {
    if (!moodRating) {
      return {
        moodToday: null,
        moodAvg: null,
        moodScoreToday: null,
      }
    }

    const moodToday = moodRating
    const moodAvg = mood5Days / numDaysMood

    const thresholds = [0.8, 1.8, 2.8, 3.8]
    const score =
      (thresholds.reduce((sum, threshold) => sum + (moodAvg >= threshold ? 1 : 0), 0) * 100) /
      thresholds.length

    return {
      moodToday,
      moodAvg,
      moodScoreToday: score,
    }
  }

  private handleStressData(
    stressRating: number | null,
    stress5Days: number,
    numDaysStress: number
  ) {
    if (!stressRating) {
      return {
        relaxToday: null,
        relaxAvg: null,
        relaxScoreToday: null,
      }
    }

    const relaxToday = stressRating
    const relaxAvg = stress5Days / numDaysStress

    const thresholds = [0.8, 1.8, 2.8, 3.8]
    const score =
      (thresholds.reduce((sum, threshold) => sum + (relaxAvg >= threshold ? 1 : 0), 0) * 100) /
      thresholds.length

    return {
      relaxToday,
      relaxAvg,
      relaxScoreToday: score,
    }
  }

  private handleActiPainsData(actiPains7Days: number[], withActivityPain: boolean) {
    if (!withActivityPain) {
      return {
        ewmaActiPains: null,
        actiDouleurToday: null,
      }
    }

    const alpha = 2 / (actiPains7Days.length + 1)
    const ewmaActiPains = ewmaScalar(actiPains7Days, alpha)

    const actiDouleurList: ScoreList[] = [
      { score: 1, threshold: 5 },
      { score: 1, threshold: 4 },
      { score: 1, threshold: 3 },
      { score: 1, threshold: 2 },
    ]

    const actiDouleurToday = this.calculateScoreFromList(ewmaActiPains, actiDouleurList, true)

    return {
      ewmaActiPains,
      actiDouleurToday,
    }
  }

  private handleHealthPainsData(outactiPains7Days: number[], withOutActivityPain: boolean) {
    if (!withOutActivityPain) {
      return {
        ewmaOutactiPains: null,
        outactiDouleurToday: null,
      }
    }

    const alpha = 2 / (outactiPains7Days.length + 1)
    const ewmaOutactiPains = ewmaScalar(outactiPains7Days, alpha)

    const outactiDouleurList: ScoreList[] = [
      { score: 1, threshold: 5 },
      { score: 1, threshold: 4 },
      { score: 1, threshold: 3 },
      { score: 1, threshold: 2 },
    ]

    const outactiDouleurToday = this.calculateScoreFromList(
      ewmaOutactiPains,
      outactiDouleurList,
      true
    )

    return {
      ewmaOutactiPains,
      outactiDouleurToday,
    }
  }

  private handleHealthSymptomsData(symptoms7Days: number[], withSymptoms: boolean) {
    if (!withSymptoms) {
      return {
        ewmaSymptoms: null,
        symptomsToday: null,
      }
    }

    const alpha = 2 / (symptoms7Days.length + 1)
    const ewmaSymptoms = ewmaScalar(symptoms7Days, alpha)

    const symptomsList: ScoreList[] = [
      { score: 1, threshold: 5 },
      { score: 1, threshold: 4 },
      { score: 1, threshold: 3 },
      { score: 1, threshold: 2 },
    ]

    const symptomsToday = this.calculateScoreFromList(ewmaSymptoms, symptomsList, true)

    return {
      ewmaSymptoms,
      symptomsToday,
    }
  }

  private handleRhrData(rhrValue: number, rhrValues30Days: number[], lastEwmaRhr: number | null) {
    const rhr =
      lastEwmaRhr !== null
        ? rhrValue * this.ALPHA_VALUE + (1 - this.ALPHA_VALUE) * lastEwmaRhr
        : rhrValue

    if (rhrValues30Days.length > 0) {
      const std30Days =
        rhrValues30Days.length > 1 ? this.calculateStandardDeviation(rhrValues30Days) : 0

      const FH = rhr + std30Days
      const FB = rhr - std30Days

      const rhrList: ScoreList[] = [
        { score: 1, threshold: 1.25 * FB },
        { score: 1, threshold: FB },
        { score: 1, threshold: FH },
      ]

      const rhrScore = this.calculateScoreFromList(rhrValue, rhrList, true)

      return {
        rhr,
        rhrScore,
        lastEwmaRhr: rhr,
        FH,
        FB,
      }
    }

    return {
      rhr,
      rhrScore: null,
      lastEwmaRhr: rhr,
      FH: null,
      FB: null,
    }
  }

  private handleHrvData(hrvValue: number, hrvValues30Days: number[], lastEwmaHrv: number | null) {
    const hrv =
      lastEwmaHrv !== null
        ? hrvValue * this.ALPHA_VALUE + (1 - this.ALPHA_VALUE) * lastEwmaHrv
        : hrvValue

    if (hrvValues30Days.length > 0) {
      const std30Days =
        hrvValues30Days.length > 1 ? this.calculateStandardDeviation(hrvValues30Days) : 0

      const FH = hrv + std30Days
      const FB = hrv - std30Days

      const hrvList: ScoreList[] = [
        { score: 1, threshold: FH },
        { score: 1, threshold: 0.75 * FH },
        { score: 1, threshold: FB },
      ]

      const hrvScore = this.calculateScoreFromList(hrvValue, hrvList)

      return {
        hrv,
        hrvScore,
        lastEwmaHrv: hrv,
        FH,
        FB,
      }
    }

    return {
      hrv,
      hrvScore: null,
      lastEwmaHrv: hrv,
      FH: null,
      FB: null,
    }
  }

  private handleTravelData(travels: Travel[]) {
    if (travels.length === 0) {
      return {
        travelFatigue: null,
        travelFatigueScore: null,
      }
    }

    const totalRawFatigue = travels.reduce((sum, travel) => {
      const rawFatigue = this.calculateTravelFatigue(travel)
      return sum + (rawFatigue || 0)
    }, 0)

    if (totalRawFatigue > 0) {
      const fatigueList: ScoreList[] = [
        { score: 1, threshold: 0.5 },
        { score: 1, threshold: 1 },
        { score: 1, threshold: 1.5 },
        { score: 1, threshold: 2 },
      ]

      const travelFatigueScore = this.calculateScoreFromList(totalRawFatigue, fatigueList, true)

      return {
        travelFatigue: totalRawFatigue,
        travelFatigueScore,
      }
    }

    return {
      travelFatigue: 0,
      travelFatigueScore: 100,
    }
  }

  private calculateTravelFatigue(travel: Travel): number | null {
    if (!travel) return 0

    const transportMode = travel.meanOfTransport.toLowerCase()
    const durationHours = travel.durationMinutes / 60

    const transportData = this.TRANSPORT_COEFFICIENTS[transportMode]
    if (!transportData) return null

    const { coefficient, tmax } = transportData
    return (durationHours * coefficient) / tmax
  }

  // TODO: move transport in database
  private readonly TRANSPORT_COEFFICIENTS: Record<string, { coefficient: number; tmax: number }> = {
    bus: { coefficient: 1.2, tmax: 8 },
    train: { coefficient: 0.8, tmax: 6 },
    plane: { coefficient: 1.5, tmax: 10 },
    car: { coefficient: 1.0, tmax: 6 },
    bike: { coefficient: 0.5, tmax: 4 },
    other: { coefficient: 1.0, tmax: 6 },
  }

  private calculateScoreFromList(
    value: number,
    list: ScoreList[],
    isInferior: boolean = false
  ): number {
    if (isInferior) {
      const scores = list.map((item) => (value <= item.threshold ? item.score : 0))
      return (scores.reduce((sum, score) => sum + score, 0) / list.length) * 100
    } else {
      const scores = list.map((item) => (value >= item.threshold ? item.score : 0))
      return (scores.reduce((sum, score) => sum + score, 0) / list.length) * 100
    }
  }

  private calculateStandardDeviation(values: number[]): number {
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length
    const squaredDifferences = values.map((val) => Math.pow(val - mean, 2))
    const variance = squaredDifferences.reduce((sum, val) => sum + val, 0) / values.length
    return Math.sqrt(variance)
  }

  public calculateInjuryHealthScore({
    energyScore,
    moodScore,
    relaxScore,
    travelFatigueScore,
    actiDouleurScore,
    outactiDouleurScore,
    symptomsScore,
  }: {
    energyScore: number | null
    moodScore: number | null
    relaxScore: number | null
    travelFatigueScore: number | null
    actiDouleurScore: number | null
    outactiDouleurScore: number | null
    symptomsScore: number | null
  }): number | null {
    // Main category weights
    const mainWeights = {
      affectsScore: 0.2, // Affects (20%)
      painScore: 0.6, // Douleurs (60%)
      symptomsScore: 0.2, // Symptômes (20%)
    }

    // Affects sub-weights
    const affectsWeights = {
      energyScore: 0.25, // Energie (25%)
      moodScore: 0.25, // Humeur (25%)
      relaxScore: 0.25, // Relax (25%)
      travelFatigueScore: 0.25, // Fatigue travel (25%)
    }

    // Pain sub-weights (inchangé)
    const painWeights = {
      activityPainScore: 0.4, // à l'effort (40%)
      nonActivityPainScore: 0.6, // en dehors de l'effort (60%)
    }

    // Calculate affects score
    const affectsScores = {
      energyScore: energyScore,
      moodScore: moodScore,
      relaxScore: relaxScore,
      travelFatigueScore: travelFatigueScore,
    }

    // Filter out null values for affects
    const validAffects: Record<string, number> = {}
    for (const [key, value] of Object.entries(affectsScores)) {
      if (value !== null && value !== undefined) {
        validAffects[key] = value
      }
    }

    let affectsScore: number | null = null
    if (Object.keys(validAffects).length > 0) {
      // Normalize affects weights
      const validAffectsWeights: Record<string, number> = {}
      let weightSum = 0
      for (const key of Object.keys(validAffects)) {
        validAffectsWeights[key] = affectsWeights[key as keyof typeof affectsWeights]
        weightSum += validAffectsWeights[key]
      }

      affectsScore = Object.entries(validAffects).reduce(
        (sum, [key, value]) => sum + value * (validAffectsWeights[key] / weightSum),
        0
      )
    }

    // Calculate pain score
    const painScores = {
      activityPainScore: actiDouleurScore,
      nonActivityPainScore: outactiDouleurScore,
    }

    // Filter out null values for pain
    const validPain: Record<string, number> = {}
    for (const [key, value] of Object.entries(painScores)) {
      if (value !== null && value !== undefined) {
        validPain[key] = value
      }
    }

    let painScore: number | null = null
    if (Object.keys(validPain).length > 0) {
      // Normalize pain weights
      const validPainWeights: Record<string, number> = {}
      let weightSum = 0
      for (const key of Object.keys(validPain)) {
        validPainWeights[key] = painWeights[key as keyof typeof painWeights]
        weightSum += validPainWeights[key]
      }

      painScore = Object.entries(validPain).reduce(
        (sum, [key, value]) => sum + value * (validPainWeights[key] / weightSum),
        0
      )
    }

    // Combine all main components (plus de cardiac)
    const mainScores = {
      affectsScore,
      painScore,
      symptomsScore,
    }

    // Filter out null values for main scores
    const validMain: Record<string, number> = {}
    for (const [key, value] of Object.entries(mainScores)) {
      if (value !== null && value !== undefined) {
        validMain[key] = value
      }
    }

    if (Object.keys(validMain).length === 0) {
      return null
    }

    // Calculate final health score with normalized main weights
    const validMainWeights: Record<string, number> = {}
    let weightSum = 0
    for (const key of Object.keys(validMain)) {
      validMainWeights[key] = mainWeights[key as keyof typeof mainWeights]
      weightSum += validMainWeights[key]
    }

    return Object.entries(validMain).reduce(
      (sum, [key, value]) => sum + value * (validMainWeights[key] / weightSum),
      0
    )
  }
}
