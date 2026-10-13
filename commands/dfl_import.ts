import { HAMBOURG_CLUB_ID } from '#constants/hambourg.constants'
import { DflService } from '#services/dfl_service'
import { BaseCommand, flags } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'

export default class DflImport extends BaseCommand {
  static commandName = 'dfl:import'
  static description =
    'Import DFL match metrics (create day/activity if missing, else attach to existing match/statsports activity)'

  static options: CommandOptions = {
    startApp: true,
  }

  @flags.string({
    description: 'Mauna club id (or DFL-CLU-* for legacy)',
    default: HAMBOURG_CLUB_ID,
  })
  declare clubId: string

  @flags.number({
    description: 'Max latest played matches to import (0 = no limit)',
    default: 10,
  })
  declare matches: number

  @flags.string({
    description: 'Season name (e.g. 2025/2026), SeasonId, or "all"',
  })
  declare season: string

  @flags.string({
    description: 'Only matches on or after this date (YYYY-MM-DD)',
  })
  declare from: string

  async run() {
    const service = await DflService.fromClubId(this.clubId || HAMBOURG_CLUB_ID)
    const season = this.season || undefined
    const fromDate = this.from || undefined
    const matchLimit = season?.toLowerCase() === 'all' && this.matches === 10 ? 0 : this.matches

    console.log(
      `DFL import club_id=${service.maunaClubId} dfl_club_id=${service.dflClubId} matches=${matchLimit === 0 ? 'all' : matchLimit}${season ? ` season=${season}` : ''}${fromDate ? ` from=${fromDate}` : ''}`
    )

    const result = await service.importClub(matchLimit, season, fromDate)

    console.log(`Matches: ${result.matches}`)
    console.log(`Imported: ${result.imported}`)
    console.log(`Activities created: ${result.activitiesCreated}`)
    console.log(`Activities updated: ${result.activitiesUpdated}`)
    console.log(`Skipped: ${result.skipped}`)
    console.log(`Failed: ${result.failed}`)

    for (const error of result.errors.slice(0, 20)) {
      console.log(`  ✗ ${error}`)
    }

    this.logger.success(`Imported ${result.imported} row(s) from ${result.matches} match(es)`)
  }
}
