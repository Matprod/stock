import { Job } from '@nemoventures/adonis-jobs'
import type { Queues } from '@nemoventures/adonis-jobs/types'
import { HAMBOURG_CLUB_ID } from '#constants/hambourg.constants'
import type { HamburgMlDailyScoresResult } from '#contracts/hamburg'
import { HamburgPipelineService } from '#services/machine_learning/hamburg/hamburg_pipeline_service'

export type ProcessHamburgDailyScoresData = {
  from: string
  to: string
  clubId?: string
}

export default class ProcessHamburgDailyScoresJob extends Job<
  ProcessHamburgDailyScoresData,
  HamburgMlDailyScoresResult
> {
  static defaultQueue: keyof Queues = 'hamburg'

  async process(): Promise<HamburgMlDailyScoresResult> {
    try {
      const clubId = this.data.clubId ?? HAMBOURG_CLUB_ID
      this.logger.info('Processing Hamburg daily scores', this.data)

      const result = await new HamburgPipelineService().runDailyScores({
        start_date: this.data.from,
        end_date: this.data.to,
        club_id: clubId,
      })

      this.logger.info('Hamburg daily scores finished', {
        from: result.from,
        to: result.to,
        stages: result.stages,
        reports: result.reports,
      })

      return result
    } catch (error) {
      this.fail(error)
    }
  }
}
