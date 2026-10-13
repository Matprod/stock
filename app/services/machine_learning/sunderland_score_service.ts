import { DateTime } from 'luxon'
import Athlete from '#models_pg/athlete'
import Day from '#models_pg/day'
import Period from '#models_pg/period'
import { TrainMyAthleteService } from '#services/train_my_athlete_service'
import { CatapultService } from '#services/catapult_service'
import SlackService from '#services/slack_service'
import SunderlandService from '#services/machine_learning/sunderland_service'
import TrainingLoadFactorsService from '#services/machine_learning/sunderland/training_load_factors_service'
import PerformanceScoreV2Service from '#services/machine_learning/sunderland/performance_score_v2_service'
// import FeatureImportanceService from '#services/machine_learning/sunderland/feature_importance_service'
import InjuryPredictionService from '#services/machine_learning/sunderland/injury_prediction_service'
import ChatbotReportService from '#services/chatbot_report_service'
import type { PredictionType } from '#constants/insight.constants'
import {
  isChatbotMlClub,
  SUNDERLAND_CLUB_IDS,
  isSunderlandClub,
} from '#constants/chatbot.constants'
import { shouldExcludeDateFromPrediction } from '../../utils/injury.js'
import { retryOn503 } from '../../utils/retry_on_503.js'

export { SUNDERLAND_CLUB_IDS, isSunderlandClub }

export type GenerateSunderlandScoresOptions = {
  sendSlack?: boolean
  athleteId?: string
}

export default class SunderlandScoreService {
  private readonly trainMyAthleteService: TrainMyAthleteService
  private readonly catapultService: CatapultService
  private readonly sunderlandService: SunderlandService
  private readonly trainingLoadFactorsService: TrainingLoadFactorsService
  private readonly performanceScoreV2Service: PerformanceScoreV2Service
  // private readonly featureImportanceService: FeatureImportanceService
  private readonly injuryPredictionService: InjuryPredictionService
  private readonly chatbotReportService: ChatbotReportService
  private readonly slackService: SlackService

  constructor() {
    this.trainMyAthleteService = new TrainMyAthleteService()
    this.catapultService = new CatapultService()
    this.sunderlandService = new SunderlandService()
    this.trainingLoadFactorsService = new TrainingLoadFactorsService()
    this.performanceScoreV2Service = new PerformanceScoreV2Service()
    // this.featureImportanceService = new FeatureImportanceService()
    this.injuryPredictionService = new InjuryPredictionService()
    this.chatbotReportService = new ChatbotReportService()
    this.slackService = new SlackService()
  }

  async generateScoresForAllAthletes(
    targetDate: DateTime,
    options: GenerateSunderlandScoresOptions = {}
  ): Promise<void> {
    const { sendSlack = true, athleteId } = options
    const dateStr = targetDate.toFormat('yyyy-MM-dd')
    const filterIds = athleteId
      ? athleteId
          .split(',')
          .map((id) => id.trim())
          .filter(Boolean)
      : undefined

    const query = Athlete.query()
      .whereIn('clubId', [...SUNDERLAND_CLUB_IDS])
      .where((q) => {
        q.whereNull('startDate').orWhere('startDate', '<=', targetDate.toJSDate())
      })
      .where((q) => {
        q.whereNull('endDate').orWhere('endDate', '>=', targetDate.toJSDate())
      })
      .preload('injuries', (q) => q.whereNotNull('dateOfInjury'))

    if (filterIds !== undefined && filterIds.length > 0) {
      query.whereIn('id', filterIds)
    }

    const athletes = await query
    const athletesNotInjured = athletes.filter(
      (athlete) => !shouldExcludeDateFromPrediction(athlete.injuries, targetDate)
    )

    if (athletesNotInjured.length === 0) {
      console.log(
        `No athletes to process for ${dateStr}${filterIds ? ` (filter: ${filterIds.join(', ')})` : ''}`
      )
      return
    }

    console.log(
      `Generating Sunderland scores for ${athletesNotInjured.length} athlete(s) (${athletes.length - athletesNotInjured.length} injured, skipped) for ${dateStr}`
    )

    if (sendSlack) {
      const scope = athleteId ? `for athlete ${athleteId}` : `for all (${athletes.length}) athletes`
      await this.slackService.sendMessage(
        `Generating Sunderland scores ${scope} for ${dateStr}`,
        'logs'
      )
    }

    await this.fetchAndProcessTMAData(targetDate, sendSlack)
    await this.processCatapultImputation(targetDate, sendSlack)
    await this.processSunderlandImputation(athletesNotInjured, targetDate, sendSlack)
    await this.calculateTrainingLoadFactors(athletesNotInjured, targetDate)
    await this.calculatePerformanceScoresV2ForNextDay(athletesNotInjured, targetDate)
    // await this.calculateFeatureImportances(athletesNotInjured, targetDate)
    await this.calculateInjuryScores(athletesNotInjured, targetDate)
    await this.generateChatbotReports(athletesNotInjured, targetDate.plus({ days: 1 }))

    const scopeLabel = athleteId ? `for athlete ${athleteId}` : 'for all athletes'
    console.log(`Completed generating Sunderland scores for ${scopeLabel} for ${dateStr}`)
    if (sendSlack) {
      await this.slackService.sendMessage(
        `Sunderland scores generated for ${scopeLabel} for ${dateStr}`,
        'logs'
      )
    }
  }

  private async fetchAndProcessTMAData(targetDate: DateTime, sendSlack: boolean): Promise<void> {
    console.log('Step 1: Fetching TMA data for yesterday')
    try {
      const reports = await this.trainMyAthleteService.getReports({
        from: targetDate.minus({ days: 14 }).toFormat('yyyy-MM-dd'),
        to: targetDate.plus({ days: 1 }).toFormat('yyyy-MM-dd'),
      })
      await this.trainMyAthleteService.processReports(reports)
      console.log(
        `Processed ${reports.injuries.length} injuries and ${reports.screeningEntries.length} screening entries`
      )
    } catch (error) {
      console.error('Error fetching TMA data:', error)
      if (sendSlack) {
        await this.slackService.sendMessage(
          `Error fetching TMA data for ${targetDate.toFormat('yyyy-MM-dd')}: ${error instanceof Error ? error.message : 'Unknown error'}`,
          'logs'
        )
      }
    }
  }

  private async processCatapultImputation(targetDate: DateTime, sendSlack: boolean): Promise<void> {
    const dateStr = targetDate.toFormat('yyyy-MM-dd')
    console.log('Step 2: Processing Catapult imputation for yesterday')
    try {
      const periods = await Period.query()
        .whereHas('sportActivity', (query) => {
          query
            .whereHas('day', (query) => {
              query.where('dateOfDay', dateStr).whereHas('athlete', (query) => {
                query.whereIn('clubId', [...SUNDERLAND_CLUB_IDS])
              })
            })
            .where('dataSource', 'catapult')
        })
        .whereHas('metricValues', (query) => {
          query.whereHas('metric', (query) => {
            query.where('name', 'average_gnss_quality')
          })
          query.where('value', '<', 50)
        })

      if (periods.length > 0) {
        console.log(`Found ${periods.length} periods to impute for Catapult`)
        await retryOn503(
          () => this.catapultService.processImputation(periods.map((p) => p.id)),
          3,
          `Catapult imputation for ${dateStr}`
        )
        console.log('Catapult imputation completed')
      } else {
        console.log('No periods found for Catapult imputation')
      }
    } catch (error) {
      console.error('Error processing Catapult imputation:', error)
      if (sendSlack) {
        await this.slackService.sendMessage(
          `Error processing Catapult imputation for ${dateStr}: ${error instanceof Error ? error.message : 'Unknown error'}`,
          'logs'
        )
      }
    }
  }

  private async processSunderlandImputation(
    athletesNotInjured: Athlete[],
    targetDate: DateTime,
    sendSlack: boolean
  ): Promise<void> {
    console.log('Step 3: Processing Sunderland imputation for yesterday')
    try {
      await retryOn503(
        () =>
          this.sunderlandService.processAndImpute(
            athletesNotInjured.map((a) => a.id),
            targetDate,
            targetDate.endOf('day')
          ),
        3,
        `Sunderland imputation for ${targetDate.toFormat('yyyy-MM-dd')}`
      )
      console.log('Sunderland imputation completed')
    } catch (error) {
      console.error('Error processing Sunderland imputation:', error)
      if (sendSlack) {
        await this.slackService.sendMessage(
          `Error processing Sunderland imputation for ${targetDate.toFormat('yyyy-MM-dd')}: ${error instanceof Error ? error.message : 'Unknown error'}`,
          'logs'
        )
      }
    }
  }

  private async calculatePerformanceScoresV2ForNextDay(
    athletesNotInjured: Athlete[],
    targetDate: DateTime
  ): Promise<void> {
    console.log('Step 4: Calculating V2 performance scores for day+1')
    for (const athlete of athletesNotInjured) {
      try {
        const performanceScore = await retryOn503(
          () =>
            this.performanceScoreV2Service.predictAndStoreScoreForNextDay(athlete.id, targetDate),
          3,
          `Performance score v2 for athlete ${athlete.id} (${athlete.firstName} ${athlete.lastName})`
        )
        console.log(
          `Performance score v2 for athlete ${athlete.id} (${athlete.firstName} ${athlete.lastName}) on ${targetDate.plus({ days: 1 }).toFormat('yyyy-MM-dd')}: ${performanceScore}`
        )
      } catch (error) {
        console.error(`Error calculating performance score v2 for athlete ${athlete.id}:`, error)
      }
    }
  }

  private async calculateTrainingLoadFactors(
    athletesNotInjured: Athlete[],
    targetDate: DateTime
  ): Promise<void> {
    console.log('Step 5: Calculating training load factors for yesterday')
    for (const athlete of athletesNotInjured) {
      try {
        await retryOn503(
          () => this.trainingLoadFactorsService.calculateFactorsForDay(athlete.id, targetDate),
          3,
          `Training load factors for athlete ${athlete.id} (${athlete.firstName} ${athlete.lastName})`
        )
        console.log(
          `Training load factors calculated for athlete ${athlete.id} (${athlete.firstName} ${athlete.lastName})`
        )
      } catch (error) {
        console.error(`Error calculating training load factors for athlete ${athlete.id}:`, error)
      }
    }
  }

  // private async calculateFeatureImportances(
  //   athletesNotInjured: Athlete[],
  //   targetDate: DateTime
  // ): Promise<void> {
  //   console.log('Step 6: Calculating feature importances for yesterday')
  //   for (const athlete of athletesNotInjured) {
  //     try {
  //       await retryOn503(
  //         () =>
  //           this.featureImportanceService.calculateFeatureImportanceForDay(athlete.id, targetDate),
  //         3,
  //         `Feature importances for athlete ${athlete.id} (${athlete.firstName} ${athlete.lastName})`
  //       )
  //       console.log(
  //         `Feature importances calculated for athlete ${athlete.id} (${athlete.firstName} ${athlete.lastName})`
  //       )
  //     } catch (error) {
  //       console.error(`Error calculating feature importances for athlete ${athlete.id}:`, error)
  //     }
  //   }
  // }

  private async calculateInjuryScores(
    athletesNotInjured: Athlete[],
    targetDate: DateTime
  ): Promise<void> {
    console.log('Step 7: Calculating injury scores for yesterday')
    for (const athlete of athletesNotInjured) {
      try {
        const payload = await this.injuryPredictionService.preparePredictionDataForDays(
          athlete.id,
          targetDate,
          targetDate.endOf('day')
        )

        if (payload.data.length === 0) {
          console.log(
            `No data to process for injury prediction for athlete ${athlete.id} on ${targetDate.toFormat('yyyy-MM-dd')}`
          )
          continue
        }

        const predictionResponse = await retryOn503(
          () => this.injuryPredictionService.predictInjuryRisk(payload),
          3,
          `Injury prediction for athlete ${athlete.id} (${athlete.firstName} ${athlete.lastName})`
        )
        await this.injuryPredictionService.storePredictionResult(predictionResponse)
        console.log(
          `Injury score calculated for athlete ${athlete.id} (${athlete.firstName} ${athlete.lastName})`
        )
      } catch (error) {
        console.error(`Error calculating injury score for athlete ${athlete.id}:`, error)
      }
    }
  }

  private async generateChatbotReports(
    athletesNotInjured: Athlete[],
    targetDate: DateTime
  ): Promise<void> {
    console.log('Step 8: Generating chatbot reports for yesterday')
    for (const athlete of athletesNotInjured) {
      try {
        const day = await Day.query()
          .where('athleteId', athlete.id)
          .where('dateOfDay', targetDate.toJSDate())
          .first()

        if (!day) {
          console.log(
            `No day found for athlete ${athlete.id} on ${targetDate.toFormat('yyyy-MM-dd')}`
          )
          continue
        }

        if (day.performanceScore !== null || day.injuryRiskScore !== null) {
          const categories: PredictionType[] = []
          if (day.performanceScore !== null) categories.push('performance')
          if (day.injuryRiskScore !== null) categories.push('injury')

          if (categories.length === 2 && isChatbotMlClub(athlete.clubId)) {
            await this.chatbotReportService.generateReportsWithSharedCache(
              athlete,
              day,
              targetDate.toFormat('yyyy-MM-dd'),
              categories
            )
          } else {
            if (day.performanceScore !== null) {
              await this.chatbotReportService.generateReportIfNeeded(
                athlete.id,
                day,
                day.performanceScore,
                'performance'
              )
            }
            if (day.injuryRiskScore !== null) {
              await this.chatbotReportService.generateReportIfNeeded(
                athlete.id,
                day,
                day.injuryRiskScore,
                'injury'
              )
            }
          }
        }

        console.log(
          `Chatbot reports generated for athlete ${athlete.id} (${athlete.firstName} ${athlete.lastName})`
        )
      } catch (error) {
        console.error(`Error generating chatbot report for athlete ${athlete.id}:`, error)
      }
    }
  }
}
