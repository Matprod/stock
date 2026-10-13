import { CalculateScoreDataPayload } from '#contracts/score'
import { ActivityScores } from '#contracts/score'
import { DateTime } from 'luxon'
import { ewmaScalar, standardDeviation } from '../../utils/statistics.js'

export default class ActivityScoreService {
  private calculateTrainingLoadMetrics(
    trainingLoads: number[]
  ): Pick<
    ActivityScores,
    | 'ceMean'
    | 'ceMeanPosition'
    | 'meanCEs'
    | 'ceVar'
    | 'varCEValue'
    | 'acwrCEs'
    | 'acwrLevel'
    | 'acwrFinalScore'
  > {
    if (trainingLoads.length === 0) {
      return {
        ceMean: null,
        ceMeanPosition: null,
        meanCEs: null,
        ceVar: null,
        varCEValue: null,
        acwrCEs: null,
        acwrLevel: null,
        acwrFinalScore: null,
      }
    }

    const SEVEN_DAYS_ALPHA = 2 / (trainingLoads.length < 7 ? trainingLoads.length : 7)
    const THIRTY_DAYS_ALPHA =
      2 / (trainingLoads.length < 7 ? trainingLoads.length + 1 : trainingLoads.length)

    let meanCEs: number | null = null
    let acwrCEs: number | null = null

    if (trainingLoads.length > 0) {
      const ewma7 = ewmaScalar([...trainingLoads].slice(0, 7).reverse(), SEVEN_DAYS_ALPHA)
      const ewma30 = ewmaScalar([...trainingLoads].slice(0, 30).reverse(), THIRTY_DAYS_ALPHA)

      meanCEs = ewma7
      acwrCEs = ewma30 !== 0 ? ewma7 / ewma30 : null
    }

    let varCEs: number | null = null
    if (trainingLoads.length < 2) {
      varCEs = trainingLoads.length === 1 ? 0 : null
    } else {
      const trainingLoadLength = trainingLoads.length
      varCEs = standardDeviation(
        trainingLoads.slice(0, trainingLoadLength > 7 ? 7 : trainingLoadLength)
      )
    }

    let ceMean: number | null = null
    let ceMeanPosition: 'below' | 'above' | 'in' | null = null

    if (meanCEs !== null) {
      const cesMeanList: number[] = []
      if (50 <= meanCEs && meanCEs <= 70) {
        cesMeanList.push(1)
      } else {
        cesMeanList.push(0)
      }
      if (52.5 <= meanCEs && meanCEs <= 67.5) {
        cesMeanList.push(1)
      } else {
        cesMeanList.push(0)
      }
      if (55 <= meanCEs && meanCEs <= 65) {
        cesMeanList.push(1)
      } else {
        cesMeanList.push(0)
      }

      ceMean = (cesMeanList.reduce((a, b) => a + b, 0) * 100) / cesMeanList.length

      ceMeanPosition = 'in'
      if (meanCEs < 55) {
        ceMeanPosition = 'below'
      } else if (meanCEs > 65) {
        ceMeanPosition = 'above'
      }
    }

    let ceVar: number | null = null
    if (varCEs !== null) {
      const cesVarList: number[] = []
      if (varCEs > 3) cesVarList.push(1)
      else cesVarList.push(0)
      if (varCEs > 5) cesVarList.push(1)
      else cesVarList.push(0)
      if (varCEs > 7) cesVarList.push(1)
      else cesVarList.push(0)
      if (varCEs > 9) cesVarList.push(1)
      else cesVarList.push(0)

      ceVar = (cesVarList.reduce((a, b) => a + b, 0) * 100) / cesVarList.length
    }

    let acwrLevel: 'low' | 'in between' | 'high' | null = null
    let acwrFinalScore: number | null = null

    if (acwrCEs !== null) {
      if (acwrCEs > 3) {
        acwrLevel = 'high'
      } else if (acwrCEs < 0.75) {
        acwrLevel = 'low'
      } else {
        acwrLevel = 'in between'
      }

      const acwrList: number[] = []
      if (acwrCEs < 3 && acwrCEs > 0.8) {
        acwrList.push(1)
      } else {
        acwrList.push(0)
      }
      if (acwrCEs <= 1.5 && acwrCEs > 0.8) {
        acwrList.push(1)
      } else {
        acwrList.push(0)
      }
      if (acwrCEs <= 1.2 && acwrCEs > 0.8) {
        acwrList.push(1)
      } else {
        acwrList.push(0)
      }

      acwrFinalScore = (acwrList.reduce((a, b) => a + b, 0) * 100) / acwrList.length
    }

    return {
      ceMean,
      ceMeanPosition,
      meanCEs,
      ceVar,
      varCEValue: varCEs,
      acwrCEs,
      acwrLevel,
      acwrFinalScore,
    }
  }

  private calculateFrequencyMetrics(
    numberActi7: number,
    numberActi14: number,
    numberActi21: number
  ): Pick<ActivityScores, 'frequency' | 'frequencyLevel' | 'meanActi3w'> {
    let meanActi3w: number | null = null
    if (numberActi21 === numberActi7) {
      meanActi3w = numberActi21
    } else if (numberActi21 === numberActi14) {
      meanActi3w = numberActi21 / 2
    } else {
      meanActi3w = numberActi21 / 3
    }

    let frequencyLevel: 'too low' | 'too high' | null = null
    if (numberActi14 === 0) {
      frequencyLevel = 'too low'
    } else if (meanActi3w - 1.5 > numberActi7) {
      frequencyLevel = 'too low'
    } else if (numberActi7 > meanActi3w + 1.5) {
      frequencyLevel = 'too high'
    }

    let frequency: number | null = null
    if (numberActi14 !== 0) {
      const freqList: number[] = []
      if (meanActi3w - 0.5 <= numberActi7 && numberActi7 <= meanActi3w + 0.5) {
        freqList.push(1)
      } else {
        freqList.push(0)
      }
      if (meanActi3w - 1 <= numberActi7 && numberActi7 <= meanActi3w + 1) {
        freqList.push(1)
      } else {
        freqList.push(0)
      }
      frequency = (freqList.reduce((a, b) => a + b, 0) * 100) / freqList.length
    }

    return {
      frequency,
      frequencyLevel,
      meanActi3w,
    }
  }

  private calculateRecoveryMetrics(
    recoveryScore: number | null
  ): Pick<ActivityScores, 'recoveryLevel' | 'recoveryFinalScore' | 'recoveryScoreToday'> {
    const recoveryScoreToday = recoveryScore !== null ? Math.min(recoveryScore, 100) : null
    let recoveryLevel: 'high' | 'medium' | 'low' | null = null
    let recoveryFinalScore: number | null = null

    if (recoveryScore !== null) {
      if (recoveryScore >= 69) {
        recoveryLevel = 'high'
      } else if (recoveryScore >= 34) {
        recoveryLevel = 'medium'
      } else {
        recoveryLevel = 'low'
      }

      const recoveryList: number[] = []
      if (recoveryScore >= 69) {
        recoveryList.push(1)
      } else {
        recoveryList.push(0)
      }
      if (recoveryScore >= 34) {
        recoveryList.push(1)
      } else {
        recoveryList.push(0)
      }
      if (recoveryList.length !== 0) {
        recoveryFinalScore = (recoveryList.reduce((a, b) => a + b, 0) * 100) / recoveryList.length
      }
    }

    return {
      recoveryLevel,
      recoveryFinalScore,
      recoveryScoreToday,
    }
  }

  async calculateActivityScore(
    data: CalculateScoreDataPayload,
    date: string
  ): Promise<ActivityScores> {
    const { days } = data

    const sortedDays = [...days].sort((a, b) => a.date.getTime() - b.date.getTime())

    const targetDate = DateTime.fromFormat(date, 'yyyy-MM-dd').toJSDate()
    const currentDay = sortedDays.find((day) => day.date.getTime() === targetDate.getTime())

    if (!currentDay) {
      throw new Error(`No data found for date ${date}`)
    }

    const { activity } = currentDay

    const defaultScore = {
      ceMean: null,
      ceMeanPosition: null,
      meanCEs: null,
      ceVar: null,
      varCEValue: null,
      acwrCEs: null,
      acwrLevel: null,
      acwrFinalScore: null,
      frequency: null,
      frequencyLevel: null,
      meanActi3w: null,
      recoveryLevel: null,
      recoveryFinalScore: null,
      recoveryScoreToday: null,
      trainingLoads: [],
      numberActi7: null,
    }

    if (!activity) {
      return defaultScore
    }

    const lastTrainingLoads = sortedDays
      .map((day) => {
        let trainingLoadDay = 0
        let trainingLoadCumulatedDay = 0

        const activities = day.activity.activities

        for (const activity of activities) {
          const trainingLoad = activity.trainingLoad
          if (trainingLoad) {
            trainingLoadCumulatedDay += trainingLoad
            trainingLoadDay += Math.log(1 + trainingLoad) * trainingLoad
          }
        }

        if (Math.log(1 + trainingLoadCumulatedDay) === 0) {
          return 0
        }

        return Math.min(trainingLoadDay / Math.log(1 + trainingLoadCumulatedDay), 100)
      })
      .reverse()

    const trainingLoadMetrics =
      lastTrainingLoads.length > 0
        ? this.calculateTrainingLoadMetrics(lastTrainingLoads)
        : {
            ceMean: null,
            ceMeanPosition: null,
            meanCEs: null,
            ceVar: null,
            varCEValue: null,
            acwrCEs: null,
            acwrLevel: null,
            acwrFinalScore: null,
          }

    const numberActi7 = sortedDays
      .slice(-7)
      .reduce((count, day) => count + (day.activity?.activities?.length ?? 0), 0)

    const numberActi14 = sortedDays
      .slice(-14)
      .reduce((count, day) => count + (day.activity?.activities?.length ?? 0), 0)

    if (numberActi7 === 0) {
      return defaultScore
    }

    const numberActi21 = sortedDays
      .slice(-21)
      .reduce((count, day) => count + (day.activity?.activities?.length ?? 0), 0)

    const frequencyMetrics = this.calculateFrequencyMetrics(numberActi7, numberActi14, numberActi21)

    const recoveryScore = currentDay.activity.recoveryScore ?? null
    const recoveryMetrics = this.calculateRecoveryMetrics(recoveryScore)

    return {
      ...trainingLoadMetrics,
      ...frequencyMetrics,
      ...recoveryMetrics,
      trainingLoads: lastTrainingLoads,
      numberActi7,
    }
  }

  public calculateInjuryActivityScore({
    ceMean,
    ceVar,
    acwrFinalScore,
    recoveryScore,
  }: {
    ceMean: number | null
    ceVar: number | null
    acwrFinalScore: number | null
    recoveryScore: number | null
  }): number | null {
    const mainWeights = {
      trainingLoad: 0.8,
      recovery: 0.2,
    }

    // Training load sub-weights
    const trainingLoadWeights = {
      meanLoadScore: 0.25,
      stdLoadScore: 0.25,
      acwrScore: 0.5,
    }

    // Calculate training load score
    const trainingLoadScores = {
      meanLoadScore: ceMean,
      stdLoadScore: ceVar,
      acwrScore: acwrFinalScore,
    }

    // Filter out null values for training load
    const validTrainingScores: Record<string, number> = {}
    for (const [key, value] of Object.entries(trainingLoadScores)) {
      if (value !== null && value !== undefined) {
        validTrainingScores[key] = value
      }
    }

    let trainingLoadScore: number | null = null
    if (Object.keys(validTrainingScores).length > 0) {
      // Normalize training load weights
      const validTrainingWeights: Record<string, number> = {}
      let weightSum = 0
      for (const key of Object.keys(validTrainingScores)) {
        validTrainingWeights[key] = trainingLoadWeights[key as keyof typeof trainingLoadWeights]
        weightSum += validTrainingWeights[key]
      }

      trainingLoadScore = Object.entries(validTrainingScores).reduce(
        (sum, [key, value]) => sum + value * (validTrainingWeights[key] / weightSum),
        0
      )
    }

    if (trainingLoadScore !== null && recoveryScore !== null) {
      return mainWeights.trainingLoad * trainingLoadScore + mainWeights.recovery * recoveryScore
    }
    return trainingLoadScore ?? recoveryScore ?? null
  }
}
