import { GarminSleep } from '#contracts/garmin'
import { Job } from '@nemoventures/adonis-jobs'
import type { Queues } from '@nemoventures/adonis-jobs/types'
import { inject } from '@adonisjs/core'
import { GarminService } from '#services/garmin_service'

export type ProcessGarminSleepData = Array<GarminSleep>

export type ProcessGarminSleepReturn = {
  success: boolean
}

@inject()
export default class ProcessGarminSleepJob extends Job<
  ProcessGarminSleepData,
  ProcessGarminSleepReturn
> {
  static defaultQueue: keyof Queues = 'garmin'

  constructor(private garminService: GarminService) {
    super()
  }

  async process(): Promise<ProcessGarminSleepReturn> {
    try {
      this.logger.info('Processing garmin sleeps', this.data)
      await this.garminService.processGarminSleeps(this.data)
      return { success: true }
    } catch (error) {
      this.fail(error)
    }
  }
}
