import HambourgCkSheetService from '#services/hambourg_ck_sheet_service'
import { BaseCommand, flags } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'

export default class HambourgImportCkSheet extends BaseCommand {
  static commandName = 'hambourg:import-ck-sheet'
  static description =
    'Import Hamburg CK from the new-season workbook (Name, no PersonId) from 2026-04-08'

  static options: CommandOptions = {
    startApp: true,
  }

  @flags.string({
    description: 'Path to the CK xlsx (default: hambourg/new_season/CK Z-Score*.xlsx)',
  })
  declare file: string | undefined

  @flags.string({ description: 'Import rows on or after this ISO date', default: '2026-04-08' })
  declare from: string

  @flags.boolean({ description: 'Parse and match only, do not write', default: false })
  declare dryRun: boolean

  async run() {
    const result = await new HambourgCkSheetService().importFile({
      file: this.file,
      from: this.from,
      dryRun: this.dryRun,
    })

    this.logger.info(result.file)
    this.logger.info(
      `From ${result.from}: create ${result.created}, update ${result.updated}, unchanged ${result.unchanged}`
    )
    if (result.missing.length > 0) {
      this.logger.warning(`Missing athlete: ${result.missing.join(', ')}`)
    }
    if (result.ambiguous.length > 0) {
      this.logger.warning(`Ambiguous name: ${result.ambiguous.join(', ')}`)
    }

    if (result.dryRun) {
      this.logger.success('Dry run, nothing written')
      return
    }

    this.logger.success(`Imported ${result.created} CK value(s), updated ${result.updated}`)
  }
}
