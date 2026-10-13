import { BOURG_CLUB_ID, VALD_FULL_SYNC_FROM, VALD_REQUEST_DELAY_MS } from '#constants/vald.constants'
import ValdService from '#services/vald_service'
import { BaseCommand, flags } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import { DateTime } from 'luxon'

export default class ValdSync extends BaseCommand {
  static commandName = 'vald:sync'
  static description = 'Backfill VALD ForceDecks tests for a club from a given date'

  static options: CommandOptions = {
    startApp: true,
  }

  @flags.string({ description: 'Club id', default: BOURG_CLUB_ID })
  declare clubId: string

  @flags.string({
    description: 'From ISO date (inclusive, UTC)',
    default: VALD_FULL_SYNC_FROM,
  })
  declare from: string

  @flags.boolean({ description: 'Fetch tests without writing vald_tests / vald_trials' })
  declare dryRun: boolean

  @flags.number({ description: 'Delay between API calls in ms', default: VALD_REQUEST_DELAY_MS })
  declare delayMs: number

  async run() {
    const start = DateTime.fromISO(this.from, { zone: 'utc' }).startOf('day')
    if (!start.isValid) {
      this.logger.error(`Invalid --from ${this.from}`)
      this.exitCode = 1
      return
    }
    const modifiedFromUtc = start.toUTC().toISO()
    if (!modifiedFromUtc) {
      this.logger.error('Could not build modifiedFromUtc')
      this.exitCode = 1
      return
    }

    const service = await ValdService.fromClubId(this.clubId)
    this.logger.info(
      `club=${this.clubId} from=${modifiedFromUtc} delayMs=${this.delayMs}${this.dryRun ? ' dry-run' : ''}`
    )

    const result = await service.syncClubAthletes({
      modifiedFromUtc,
      delayMs: this.delayMs,
      dryRun: this.dryRun,
    })

    this.logger.info(
      `athletes=${result.athleteCount} synced=${result.synced} failed=${result.failed} tests=${result.testsImported}`
    )

    if (result.athleteCount === 0) {
      this.logger.error('No VALD athlete_providers for this club')
      this.exitCode = 1
    }
  }
}
