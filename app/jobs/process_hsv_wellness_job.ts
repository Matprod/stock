import { Job } from '@nemoventures/adonis-jobs'
import type { Queues } from '@nemoventures/adonis-jobs/types'
import type { HsvImportResult } from '#contracts/hsv'
import { HAMBOURG_CLUB_ID } from '#constants/hambourg.constants'
import HsvPerformanceService from '#services/hsv_performance_service'

export type ProcessHsvWellnessData = {
  from: string
  to: string
  clubId?: string
}

export default class ProcessHsvWellnessJob extends Job<ProcessHsvWellnessData, HsvImportResult> {
  static defaultQueue: keyof Queues = 'default'

  async process(): Promise<HsvImportResult> {
    try {
      const clubId = this.data.clubId ?? HAMBOURG_CLUB_ID
      this.logger.info('Processing HSV wellness import', this.data)
      const result = await HsvPerformanceService.fromEnv(clubId).importAll({
        from: this.data.from,
        to: this.data.to,
      })
      this.logger.info('HSV wellness import finished', {
        from: result.from,
        to: result.to,
        upserted: result.upserted,
        missing: result.missing.length,
        withoutSap: result.withoutSap.length,
      })

      const { default: ProcessHamburgDailyScoresJob } = await import(
        '#jobs/process_hamburg_daily_scores_job'
      )
      await ProcessHamburgDailyScoresJob.dispatch({
        from: result.from,
        to: result.to,
        clubId,
      })
      this.logger.info('Hamburg daily scores queued', {
        from: result.from,
        to: result.to,
        clubId,
      })

      return result
    } catch (error) {
      this.fail(error)
    }
  }
}
