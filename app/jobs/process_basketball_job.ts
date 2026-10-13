import { inject } from '@adonisjs/core'
import { Job } from '@nemoventures/adonis-jobs'
import type { Queues } from '@nemoventures/adonis-jobs/types'
import { BasketballService } from '#services/api_basketball_service'
import type { CreateActivityFromStatsParams } from '#contracts/api_basketball'
import SlackService from '#services/slack_service'

export type ProcessBasketballData = CreateActivityFromStatsParams

export type ProcessBasketballReturn = {
  success: boolean
  error?: string
}

const MAX_RETRIES = 3
const BASE_DELAY_MS = 2000
const MAX_DELAY_MS = 15000

function isDbTimeout(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error)
  const code =
    error && typeof error === 'object' && 'code' in error
      ? String((error as { code: string }).code)
      : ''
  return `${msg} ${code}`.toUpperCase().includes('ETIMEDOUT')
}

@inject()
export default class ProcessBasketballJob extends Job<
  ProcessBasketballData,
  ProcessBasketballReturn
> {
  static defaultQueue: keyof Queues = 'basketball'

  constructor(
    private basketballService: BasketballService,
    private slackService: SlackService
  ) {
    super()
  }

  async process(): Promise<ProcessBasketballReturn> {
    const { athleteId, game } = this.data
    const gameId = game?.id
    try {
      let lastError: unknown
      for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        try {
          await this.basketballService.persistSportActivity(this.data)
          return { success: true }
        } catch (error) {
          lastError = error
          if (attempt === MAX_RETRIES || !isDbTimeout(error)) throw error
          const delayMs = Math.min(BASE_DELAY_MS * 2 ** attempt, MAX_DELAY_MS)
          await new Promise((r) => setTimeout(r, delayMs))
        }
      }
      throw lastError
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error))
      const msg = err.message
      this.logger.error(
        { athleteId, gameId, stack: err.stack },
        `ProcessBasketballJob failed: ${msg}`
      )

      try {
        await this.slackService.sendMessage(':rotating_light: Basketball queue failed.', 'match')
      } catch (slackError) {
        this.logger.warn(
          { athleteId, gameId, error: slackError },
          'Failed to send Slack alert for ProcessBasketballJob failure'
        )
      }

      return { success: false, error: msg }
    }
  }
}
