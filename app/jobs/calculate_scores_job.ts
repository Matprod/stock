import { Job } from '@nemoventures/adonis-jobs'
import { Queues } from '@nemoventures/adonis-jobs/types'

export type CalculateScoresData = {
  athleteId: string
  startDate: string
  endDate?: string
}

export type CalculateScoresReturn = {
  success: boolean
  error?: string
}

export default class CalculateScoresJob extends Job<CalculateScoresData, CalculateScoresReturn> {
  static defaultQueue: keyof Queues = 'default'

  async process(): Promise<CalculateScoresReturn> {
    try {
      this.logger.info('Calculating scores for period', this.data)
      return { success: true }
    } catch (error) {
      this.fail(error)
    }
  }
}
