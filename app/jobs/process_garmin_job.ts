import { GarminActivity } from '#contracts/garmin'
import { Job } from '@nemoventures/adonis-jobs'
import type { Queues } from '@nemoventures/adonis-jobs/types'
import { inject } from '@adonisjs/core'
import { GarminService } from '#services/garmin_service'

export type ProcessGarminData = Array<GarminActivity>

export type ProcessGarminReturn = {
  success: boolean
}

@inject()
export default class ProcessGarminJob extends Job<ProcessGarminData, ProcessGarminReturn> {
  static defaultQueue: keyof Queues = 'garmin'

  constructor(private garminService: GarminService) {
    super()
  }

  async process(): Promise<ProcessGarminReturn> {
    try {
      this.logger.info('Processing garmin activities', this.data)
      await this.garminService.processGarminData(this.data)
      return { success: true }
    } catch (error) {
      this.fail(error)
    }
  }
}
