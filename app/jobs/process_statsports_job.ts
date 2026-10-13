import { Job } from '@nemoventures/adonis-jobs'
import type { Queues } from '@nemoventures/adonis-jobs/types'
import { StatssportsService } from '#services/statsports_service'
import type { StatssportsSyncResult } from '#contracts/statsports'

export type ProcessStatssportsData = {
  clubId: string
  sessionStart: string
  sessionEnd: string
  chunkDays?: number
}

export default class ProcessStatssportsJob extends Job<
  ProcessStatssportsData,
  StatssportsSyncResult
> {
  static defaultQueue: keyof Queues = 'statsports'

  async process(): Promise<StatssportsSyncResult> {
    try {
      this.logger.info('Processing STATSports sync', this.data)
      const service = await StatssportsService.fromClubId(this.data.clubId)
      return await service.syncDateRange({
        sessionStart: this.data.sessionStart,
        sessionEnd: this.data.sessionEnd,
        chunkDays: this.data.chunkDays,
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      this.fail(message)
    }
  }
}
