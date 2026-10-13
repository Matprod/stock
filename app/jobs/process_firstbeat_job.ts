import { inject } from '@adonisjs/core'
import FirstbeatService from '#services/firstbeat_service'
import { Job } from '@nemoventures/adonis-jobs'
import { Queues } from '@nemoventures/adonis-jobs/types'

export type ProcessFirstbeatData = {
  athleteId: string
  measurementId: number
}

export type ProcessFirstbeatReturn = {
  success: boolean
}

@inject()
export default class ProcessFirstbeatJob extends Job<ProcessFirstbeatData, ProcessFirstbeatReturn> {
  static defaultQueue: keyof Queues = 'firstBeat'

  constructor(private firstbeatService: FirstbeatService) {
    super()
  }

  async process(): Promise<ProcessFirstbeatReturn> {
    try {
      this.logger.info('Processing firstbeat measurement', this.data)
      await this.firstbeatService.processFirstbeatMeasurements(this.data)
      return { success: true }
    } catch (error) {
      this.fail(error)
    }
  }
}
