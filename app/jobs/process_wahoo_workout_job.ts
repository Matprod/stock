import { Job } from '@nemoventures/adonis-jobs'
import type { Queues } from '@nemoventures/adonis-jobs/types'
import { inject } from '@adonisjs/core'
import { WahooService } from '#services/wahoo_service'
import { WahooWorkoutSummaryWebhook } from '#contracts/wahoo'

export type ProcessWahooWorkoutData = WahooWorkoutSummaryWebhook

export type ProcessWahooWorkoutReturn = {
  success: boolean
}

@inject()
export default class ProcessWahooWorkoutJob extends Job<
  ProcessWahooWorkoutData,
  ProcessWahooWorkoutReturn
> {
  static defaultQueue: keyof Queues = 'wahoo'

  constructor(private wahooService: WahooService) {
    super()
  }

  async process(): Promise<ProcessWahooWorkoutReturn> {
    try {
      this.logger.info('Processing Wahoo workout summary', {
        wahooUserId: this.data.user.id,
        workoutSummaryId: this.data.workout_summary.id,
        workoutId: this.data.workout_summary.workout?.id,
      })
      await this.wahooService.processWorkoutSummaryWebhook(this.data)
      return { success: true }
    } catch (error) {
      this.fail(error)
    }
  }
}
