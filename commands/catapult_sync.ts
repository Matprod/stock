import { CatapultService } from '#services/catapult_service'
import SportActivity from '#models_pg/sport_activity'
import { BaseCommand, flags } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import { DateTime } from 'luxon'

export default class CatapultSync extends BaseCommand {
  static commandName = 'catapult:sync'
  static description = 'Fetch Catapult activities from a start date and queue persist jobs'

  static options: CommandOptions = {
    startApp: true,
  }

  @flags.string({ description: 'From ISO date (inclusive)', default: '2026-07-11' })
  declare from: string

  @flags.string({ description: 'To ISO date (optional, default now)' })
  declare to: string | undefined

  async run() {
    const startDate = DateTime.fromISO(this.from, { zone: 'utc' }).startOf('day')
    const endDate = this.to
      ? DateTime.fromISO(this.to, { zone: 'utc' }).endOf('day')
      : DateTime.utc()
    if (!startDate.isValid) throw new Error(`Invalid --from ${this.from}`)
    if (!endDate.isValid) throw new Error(`Invalid --to ${this.to}`)

    const latest = await SportActivity.query()
      .where('dataSource', 'catapult')
      .preload('day')
      .orderBy('createdAt', 'desc')
      .limit(5)

    this.logger.info('DB last catapult sport_activities (by createdAt):')
    for (const activity of latest) {
      this.logger.info(
        `  created=${activity.createdAt?.toISO()} day=${activity.day?.dateOfDay?.toISODate() ?? '?'} name=${activity.activityName}`
      )
    }

    this.logger.info(`Fetching ${startDate.toISO()} → ${endDate.toISO()}`)
    const results = await CatapultService.fetchAndQueueForAllClubs(startDate, endDate)
    for (const result of results) {
      if (result.error) {
        this.logger.error(`club=${result.clubId} error=${result.error}`)
        this.exitCode = 1
        continue
      }
      this.logger.info(
        `club=${result.clubId} activities=${result.activityCount} jobs=${result.queuedJobs}`
      )
    }
  }
}
