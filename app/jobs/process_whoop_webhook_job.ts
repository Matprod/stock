import { Job } from '@nemoventures/adonis-jobs'
import type { Queues } from '@nemoventures/adonis-jobs/types'
import { inject } from '@adonisjs/core'
import { WhoopService } from '#services/whoop_service'
import type { WhoopWebhookPayload } from '#contracts/whoop'

export type ProcessWhoopWebhookData = WhoopWebhookPayload

export type ProcessWhoopWebhookReturn = {
  success: boolean
}

@inject()
export default class ProcessWhoopWebhookJob extends Job<
  ProcessWhoopWebhookData,
  ProcessWhoopWebhookReturn
> {
  static defaultQueue: keyof Queues = 'whoop'

  constructor(private whoopService: WhoopService) {
    super()
  }

  async process(): Promise<ProcessWhoopWebhookReturn> {
    try {
      this.logger.info('Processing Whoop webhook', {
        whoopUserId: this.data.user_id,
        type: this.data.type,
        objectId: this.data.id,
      })
      await this.whoopService.processWebhook(this.data)
      return { success: true }
    } catch (error) {
      this.fail(error)
    }
  }
}
