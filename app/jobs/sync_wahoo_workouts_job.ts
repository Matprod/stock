import { Job } from '@nemoventures/adonis-jobs'
import type { Queues } from '@nemoventures/adonis-jobs/types'
import { inject } from '@adonisjs/core'
import { WahooService } from '#services/wahoo_service'

export type SyncWahooWorkoutsData = {
  athleteId: string
}

export type SyncWahooWorkoutsReturn = {
  success: boolean
  total: number
  queued: number
  skipped: number
}

@inject()
export default class SyncWahooWorkoutsJob extends Job<
  SyncWahooWorkoutsData,
  SyncWahooWorkoutsReturn
> {
  static defaultQueue: keyof Queues = 'wahoo'

  constructor(private wahooService: WahooService) {
    super()
  }

  async process(): Promise<SyncWahooWorkoutsReturn> {
    try {
      this.logger.info('Syncing historical Wahoo workouts', {
        athleteId: this.data.athleteId,
      })

      const result = await this.wahooService.syncHistoricalWorkouts(this.data.athleteId)

      return { success: true, ...result }
    } catch (error) {
      this.fail(error)
    }
  }
}
