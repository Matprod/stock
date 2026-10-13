import SunderlandScoreService from '#services/machine_learning/sunderland_score_service'
import { BaseCommand, flags } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import { DateTime } from 'luxon'

export default class SunderlandScores extends BaseCommand {
  static commandName = 'sunderland:scores'
  static description = 'Regenerate Sunderland scores and chatbot reports for a date range'

  static options: CommandOptions = {
    startApp: true,
  }

  @flags.string({ description: 'From ISO date (inclusive)' })
  declare from: string

  @flags.string({ description: 'To ISO date (inclusive, default yesterday)' })
  declare to: string | undefined

  @flags.string({ description: 'Limit to one athlete id' })
  declare athleteId: string | undefined

  @flags.boolean({ description: 'Post Slack progress messages', default: false })
  declare slack: boolean

  async run() {
    if (!this.from) throw new Error('--from is required (yyyy-MM-dd)')

    const startDate = DateTime.fromISO(this.from, { zone: 'utc' }).startOf('day')
    const endDate = (this.to
      ? DateTime.fromISO(this.to, { zone: 'utc' })
      : DateTime.utc().minus({ days: 1 })
    ).startOf('day')
    if (!startDate.isValid) throw new Error(`Invalid --from ${this.from}`)
    if (!endDate.isValid) throw new Error(`Invalid --to ${this.to}`)
    if (endDate < startDate) throw new Error('--to must be on or after --from')

    const days = Math.floor(endDate.diff(startDate, 'days').days) + 1
    this.logger.info(
      `Sunderland scores ${startDate.toISODate()} → ${endDate.toISODate()} (${days} day(s))${this.athleteId ? ` athlete=${this.athleteId}` : ''}`
    )

    const service = new SunderlandScoreService()
    for (let cursor = startDate; cursor <= endDate; cursor = cursor.plus({ days: 1 })) {
      const dateStr = cursor.toISODate()
      this.logger.info(`Processing ${dateStr}`)
      try {
        await service.generateScoresForAllAthletes(cursor, {
          sendSlack: this.slack,
          athleteId: this.athleteId,
        })
        this.logger.info(`Done ${dateStr}`)
      } catch (error) {
        this.logger.error(
          `Failed ${dateStr}: ${error instanceof Error ? error.message : String(error)}`
        )
        this.exitCode = 1
      }
    }
  }
}
