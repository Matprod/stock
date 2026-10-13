import { SapSportsOneService } from '#services/sapsportsone_service'
import { BaseCommand, flags } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'

export default class SapSportsOneImportInjuries extends BaseCommand {
  static commandName = 'sapsportsone:import-injuries'
  static description =
    'Import SAP SportsOne medicalEvents (INJURY) via /external/export/med/v1 into injuries'

  static options: CommandOptions = {
    startApp: true,
  }

  @flags.boolean({
    description: 'Dry run — fetch and map only, do not write injuries / types',
  })
  declare dryRun: boolean

  @flags.number({
    description: 'Number of errors printed',
    default: 20,
  })
  declare show: number

  async run() {
    const service = SapSportsOneService.fromEnv()

    console.log('')
    console.log(`SAP SportsOne medical injuries import${this.dryRun ? ' (dry-run)' : ''}`)
    console.log('Source: /external/export/med/v1/medicalEvents (EventType=INJURY)')
    console.log('')

    const result = await service.importMedicalInjuries({ dryRun: this.dryRun })

    console.log('')
    console.log('── Summary ──')
    console.log(`Events fetched:       ${result.eventsFetched}`)
    console.log(`INJURY events:        ${result.injuryEvents}`)
    console.log(`Imported:             ${result.imported}`)
    console.log(`Created injury types: ${result.createdTypes}`)
    console.log(`Skipped existing:     ${result.skippedExisting}`)
    console.log(`Mechanism synced:     ${result.mechanismSynced}`)
    console.log(`Skipped no athlete:   ${result.skippedNoAthlete}`)
    console.log(`Skipped no start:     ${result.skippedNoStart}`)
    console.log(`Section → N/A:        ${result.sectionNa}`)
    console.log(`Failed:               ${result.failed}`)

    if (result.errors.length > 0) {
      console.log('')
      console.log(`── Errors (showing ${Math.min(this.show, result.errors.length)}/${result.errors.length}) ──`)
      for (const error of result.errors.slice(0, this.show)) {
        console.log(`  ✗ ${error}`)
      }
    }

    console.log('')

    if (this.dryRun) {
      this.logger.info(
        `Dry run: would import ${result.imported} injury(ies), sync ${result.mechanismSynced} mechanism(s)`
      )
      return
    }

    if (result.failed > 0 || result.skippedNoAthlete > 0) {
      this.logger.warning(
        `Imported ${result.imported}, skipped athletes ${result.skippedNoAthlete}, failed ${result.failed}`
      )
    } else {
      this.logger.success(`Imported ${result.imported} injury(ies)`)
    }
  }
}
