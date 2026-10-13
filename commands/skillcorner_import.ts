import { HAMBOURG_CLUB_ID } from '#constants/hambourg.constants'
import { SkillcornerService } from '#services/skillcorner_service'
import { BaseCommand, flags } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'

export default class SkillcornerImport extends BaseCommand {
  static commandName = 'skillcorner:import'
  static description =
    'Import SkillCorner physical metrics onto day sport activities (name + game_activity + metrics)'

  static options: CommandOptions = {
    startApp: true,
  }

  @flags.string({
    description: 'Mauna club id',
    default: HAMBOURG_CLUB_ID,
  })
  declare clubId: string

  @flags.number({
    description: 'Number of latest matches to import (0 = all from 2022-06-20)',
    default: 10,
  })
  declare matches: number

  @flags.string({
    description: 'Only matches on or after this date (YYYY-MM-DD)',
  })
  declare from: string

  async run() {
    const service = await SkillcornerService.fromClubId(this.clubId || HAMBOURG_CLUB_ID)
    const fromDate = this.from || undefined

    console.log(
      `SkillCorner import club_id=${service.maunaClubId} team_id=${service.teamId} matches=${this.matches === 0 ? 'all' : this.matches}${fromDate ? ` from=${fromDate}` : ''}`
    )
    const result = await service.importPhysical(this.matches, fromDate)

    console.log(`Matches: ${result.matches}`)
    console.log(`Imported: ${result.imported}`)
    console.log(`Activities updated: ${result.activitiesUpdated}`)
    console.log(`Skipped: ${result.skipped}`)
    console.log(`Failed: ${result.failed}`)

    for (const error of result.errors.slice(0, 20)) {
      console.log(`  ✗ ${error}`)
    }

    this.logger.success(`Imported ${result.imported} row(s) from ${result.matches} match(es)`)
  }
}
