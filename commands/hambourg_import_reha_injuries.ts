import HambourgRehaInjuryService from '#services/hambourg_reha_injury_service'
import { BaseCommand, flags } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'

export default class HambourgImportRehaInjuries extends BaseCommand {
  static commandName = 'hambourg:import-reha-injuries'
  static description =
    'Import Hamburg reha workbook: name match, recovery only when tatsächliche Dauer is set'

  static options: CommandOptions = {
    startApp: true,
  }

  @flags.string({
    description: 'Path to the reha xlsx (default: hambourg/new_season/Reha-Benchmarks*.xlsx)',
  })
  declare file: string | undefined

  @flags.boolean({ description: 'Parse and match only, do not write', default: false })
  declare dryRun: boolean

  async run() {
    const result = await new HambourgRehaInjuryService().importFile({
      file: this.file,
      dryRun: this.dryRun,
    })

    const print = (title: string, rows: string[]) => {
      if (rows.length === 0) return
      this.logger.info(`${title} (${rows.length})`)
      for (const row of rows) this.logger.info(`  ${row}`)
    }

    this.logger.info(result.file)
    print('Create', result.created)
    print('Update', result.updated)
    print('Unchanged', result.unchanged)
    print('Missing athlete', result.missing)
    print('Ambiguous', result.ambiguous)
    print('Invalid', result.invalid)

    if (result.dryRun) {
      this.logger.success(
        `Dry run: ${result.created.length} to create, ${result.updated.length} to update`
      )
      return
    }

    this.logger.success(
      `Imported ${result.created.length} injury(ies), updated ${result.updated.length}`
    )
  }
}
