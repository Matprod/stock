import { HAMBOURG_CLUB_ID } from '#constants/hambourg.constants'
import { StatssportsService } from '#services/statsports_service'
import { BaseCommand, flags } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import { DateTime } from 'luxon'

export default class StatssportsSync extends BaseCommand {
  static commandName = 'statsports:sync'
  static description = 'Fetch STATSports sessions and persist activities/periods'

  static options: CommandOptions = {
    startApp: true,
  }

  @flags.string({ description: 'Club id', default: HAMBOURG_CLUB_ID })
  declare clubId: string

  @flags.string({ description: 'From ISO date (inclusive)' })
  declare from: string

  @flags.string({ description: 'To ISO date (optional, default now)' })
  declare to: string | undefined

  @flags.number({ description: 'Chunk size in days', default: 3 })
  declare chunkDays: number

  async run() {
    if (!this.from) {
      this.logger.error('--from is required (YYYY-MM-DD)')
      this.exitCode = 1
      return
    }

    const startDate = DateTime.fromISO(this.from, { zone: 'utc' }).startOf('day')
    const endDate = this.to
      ? DateTime.fromISO(this.to, { zone: 'utc' }).endOf('day')
      : DateTime.utc()
    if (!startDate.isValid) throw new Error(`Invalid --from ${this.from}`)
    if (!endDate.isValid) throw new Error(`Invalid --to ${this.to}`)
    if (endDate < startDate) throw new Error('--to must be >= --from')

    const sessionStart = startDate.toUTC().toISO()
    const sessionEnd = endDate.toUTC().toISO()
    if (!sessionStart || !sessionEnd) throw new Error('Invalid --from/--to ISO datetime')

    this.logger.info(
      `club=${this.clubId} ${sessionStart} → ${sessionEnd} chunkDays=${this.chunkDays}`
    )

    const service = await StatssportsService.fromClubId(this.clubId)
    const result = await service.syncDateRange({
      sessionStart,
      sessionEnd,
      chunkDays: this.chunkDays,
    })

    this.logger.info(
      `chunks=${result.chunks} bundles=${result.bundles} rows=${result.rows} imported=${result.imported} activities=${result.createdActivities} periods=${result.createdPeriods} eventsCreated=${result.createdEvents} eventsLinked=${result.linkedEvents} skippedNoPlayerId=${result.skippedNoPlayerId} skippedNoAthlete=${result.skippedNoAthlete} failed=${result.failed}`
    )
  }
}
