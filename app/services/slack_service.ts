import env from '#start/env'
import axios from 'axios'
import logger from '@adonisjs/core/services/logger'
import type { GameInfo } from '#contracts/api_basketball'
import { DateTime } from 'luxon'

export type SlackChannel = 'logs' | 'match'

export default class SlackService {
  private readonly webhookMapping: Record<SlackChannel, string | undefined> = {
    logs: env.get('SLACK_LOGS_WEBHOOK_URL'),
    match: env.get('SLACK_MATCH_WEBHOOK_URL'),
  }

  async sendMessage(text: string, channel: SlackChannel): Promise<void> {
    const webhookUrl = this.webhookMapping[channel]

    if (!webhookUrl) {
      logger.warn(
        `Slack webhook URL for channel "${channel}" is not configured. Skipping message send.`
      )
      return
    }

    try {
      await axios.post(
        webhookUrl,
        { text },
        {
          headers: {
            'Content-Type': 'application/json',
          },
        }
      )
    } catch (error) {
      logger.error({ error, channel }, 'SlackService: failed to send message')
      throw error
    }
  }

  async postBasketballMatchResult(game: GameInfo): Promise<void> {
    const homeTeam = game.teams.home.name
    const awayTeam = game.teams.away.name
    const homeScore = game.scores.home.total ?? 'N/A'
    const awayScore = game.scores.away.total ?? 'N/A'
    const date = DateTime.fromSeconds(game.timestamp).toFormat('dd/MM/yyyy HH:mm')

    const message = `🏀 *${homeTeam}* ${homeScore} - ${awayScore} *${awayTeam}* - ${date}`

    await this.sendMessage(message, 'match')
  }
}
