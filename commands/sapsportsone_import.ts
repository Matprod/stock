import { SapSportsOneService } from '#services/sapsportsone_service'
import { BaseCommand, flags } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'

export default class SapSportsOneImport extends BaseCommand {
  static commandName = 'sapsportsone:import'
  static description =
    'Import SAP SportsOne questionnaire answers (Sleep, Befinden, RPE Training pre/post, AT-IT-RT, Status Verletzung)'

  static options: CommandOptions = {
    startApp: true,
  }

  @flags.number({
    description: 'Stop after N mapped answers (0 = all)',
    default: 0,
  })
  declare limit: number

  async run() {
    const service = SapSportsOneService.fromEnv()

    console.log('')
    console.log('SAP SportsOne questionnaire import')
    console.log(
      'Questions: Sleep, körperliches/mentales Befinden, Anstrengung/RPE Training → pre|post_training_rpe, RPE AT/IT/RT, Status Verletzung'
    )
    if (this.limit > 0) {
      console.log(`limit=${this.limit} mapped answers`)
    }
    console.log('')

    const result = await service.importMappedAnswers({
      maxAnswers: this.limit > 0 ? this.limit : undefined,
    })

    console.log('')
    console.log('── Summary ──')
    console.log(`Answers fetched: ${result.answersFetched}`)
    console.log(`Answers mapped:  ${result.answersMapped}`)
    console.log(`Imported:        ${result.imported}`)
    console.log(`Skipped (no SAP athlete provider): ${result.skippedNoAthlete}`)
    console.log(`Failed:          ${result.failed}`)

    if (result.errors.length > 0) {
      console.log('')
      console.log('── Errors ──')
      for (const error of result.errors.slice(0, 20)) {
        console.log(`  ✗ ${error}`)
      }
      if (result.errors.length > 20) {
        console.log(`  ... +${result.errors.length - 20} more`)
      }
    }

    console.log('')

    if (result.failed > 0 || result.skippedNoAthlete > 0) {
      this.logger.warning(
        `Imported ${result.imported}, skipped ${result.skippedNoAthlete}, failed ${result.failed}`
      )
    } else {
      this.logger.success(`Imported ${result.imported} answer(s)`)
    }
  }
}
