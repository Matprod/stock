import { HAMBURG_ML_STAGES } from '#constants/hamburg_ml.constants'
import { HamburgPipelineService } from '#services/machine_learning/hamburg/hamburg_pipeline_service'
import type {
  HamburgMlInjuryPredictionRow,
  HamburgMlPerformancePredictionRow,
  HamburgMlPlayer,
  HamburgMlRequest,
  HamburgMlStage,
} from '#contracts/hamburg'
import { BaseCommand, flags } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'

const STAGE_CHOICES = Object.values(HAMBURG_ML_STAGES)

export default class HambourgMlPipeline extends BaseCommand {
  static commandName = 'hambourg:ml-pipeline'
  static description = 'Call ml-backend Hamburg pipeline (self-fetch DB mode)'

  static options: CommandOptions = {
    startApp: true,
  }

  @flags.string({
    description: `Pipeline stage (${STAGE_CHOICES.join(', ')})`,
    default: HAMBURG_ML_STAGES.loadFeatures as string,
  })
  declare stage: HamburgMlStage

  @flags.string({ description: 'Single day YYYY-MM-DD (exclusive with --start/--end)' })
  declare date: string

  @flags.string({ description: 'Range start YYYY-MM-DD' })
  declare start: string

  @flags.string({ description: 'Range end YYYY-MM-DD' })
  declare end: string

  @flags.array({
    name: 'athleteId',
    description: 'Athlete UUID and/or SAP PersonId (repeatable)',
  })
  declare athleteId: string[]

  @flags.boolean({ description: 'Do not persist the ML response' })
  declare skipPersist: boolean

  @flags.boolean({
    description:
      'Run daily scores: statsports-complete, subjective-imputation, daily-factors, predict/injury, predict/performance-v1, then chatbot reports',
  })
  declare daily: boolean

  @flags.string({ description: 'Write the full JSON response to this file' })
  declare out: string

  async run() {
    const service = new HamburgPipelineService()

    const hasDate = Boolean(this.date)
    const hasRange = Boolean(this.start || this.end)

    if (hasDate && hasRange) {
      this.logger.error('Use either --date or --start/--end, not both')
      this.exitCode = 1
      return
    }

    if (!hasDate && !hasRange) {
      this.logger.error('Provide --date or --start and --end')
      this.exitCode = 1
      return
    }

    if (hasRange && (!this.start || !this.end)) {
      this.logger.error('Both --start and --end are required for a date range')
      this.exitCode = 1
      return
    }

    const athleteIds = this.athleteId?.length ? this.athleteId : undefined
    const request: HamburgMlRequest = hasDate
      ? athleteIds
        ? { date: this.date, athlete_ids: athleteIds }
        : { date: this.date }
      : athleteIds
        ? { start_date: this.start, end_date: this.end, athlete_ids: athleteIds }
        : { start_date: this.start, end_date: this.end }

    if (this.daily) {
      const result = await service.runDailyScores(request, {
        skipPersist: this.skipPersist,
        dumpPath: this.out,
      })
      this.logger.info(
        `daily ${result.from} → ${result.to} stages=${result.stages.join(', ')} reports generated=${result.reports.generated} failed=${result.reports.failed} eligible=${result.reports.eligible}`
      )
      return
    }

    const result =
      (await service.runStage(this.stage, request, {
        skipPersist: this.skipPersist,
        dumpPath: this.out,
      })) ?? []

    this.logger.info(`n=${result.length}`)
    if (this.skipPersist) {
      this.logger.info('skip persist')
    } else if (this.stage === HAMBURG_ML_STAGES.statsportsComplete) {
      this.logger.info('persisted to data_processed_metric_values')
    } else if (this.stage === HAMBURG_ML_STAGES.subjectiveImputation) {
      this.logger.info('persisted to health_ratings / health_metric_values')
    } else if (this.stage === HAMBURG_ML_STAGES.dailyFactors) {
      this.logger.info('persisted to day_metric_values')
    } else if (this.stage === HAMBURG_ML_STAGES.predictInjury) {
      this.logger.info('persisted to days.injury_risk_score / feature_importances')
    } else if (this.stage === HAMBURG_ML_STAGES.predictPerformance) {
      this.logger.info('persisted to days.performance_score / feature_importances')
    }

    if (this.out) {
      this.logger.info(`wrote ${this.out}`)
    }

    if (this.stage === HAMBURG_ML_STAGES.predictInjury) {
      const row = (result as HamburgMlInjuryPredictionRow[])[0]
      if (!row) return
      console.log(
        JSON.stringify(
          {
            id: row.id,
            date: row.date ?? row.date_of_day,
            injury_risk_proba: row.injury_risk_proba,
            n_features: row.feature_importances?.length ?? 0,
            n_optimal: row.optimal_features?.length ?? 0,
          },
          null,
          2
        )
      )
      return
    }

    if (this.stage === HAMBURG_ML_STAGES.predictPerformance) {
      const row = (result as HamburgMlPerformancePredictionRow[])[0]
      if (!row) return
      console.log(
        JSON.stringify(
          {
            id: row.id,
            date: row.date,
            score_overall: row.score_overall,
            n_features: row.feature_importances?.length ?? 0,
            n_optimal: row.optimal_features?.length ?? 0,
          },
          null,
          2
        )
      )
      return
    }

    const players = result as HamburgMlPlayer[]
    const player = players[0]
    const period = player?.periods?.[0]
    const day = player?.days?.[0]

    if (!player) return

    if (day) {
      console.log(
        JSON.stringify(
          {
            playerId: player.id,
            n_days: player.days?.length ?? 0,
            dayId: day.id,
            n_metrics: day.metrics.length,
            metrics: day.metrics.slice(0, 5),
          },
          null,
          2
        )
      )
      return
    }

    if (!period) return

    console.log(
      JSON.stringify(
        {
          playerId: player.id,
          n_periods: player.periods?.length ?? 0,
          periodId: period.id,
          n_metrics: period.metrics.length,
          metrics: period.metrics.slice(0, 5),
        },
        null,
        2
      )
    )
  }
}
