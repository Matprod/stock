import { SapSportsOneService } from '#services/sapsportsone_service'
import { BaseCommand, flags } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'

export default class SapSportsOnePreview extends BaseCommand {
  static commandName = 'sapsportsone:preview'
  static description = 'Fetch a small SAP SportsOne questionnaire sample and print it'

  static options: CommandOptions = {
    startApp: false,
  }

  @flags.number({ description: 'Number of rows to fetch per endpoint', default: 10 })
  declare limit: number

  async run() {
    const service = SapSportsOneService.fromEnv()

    console.log('')
    console.log(`SAP SportsOne questionnaires sample (limit=${this.limit})`)
    console.log('')

    const sample = await service.fetchSample(this.limit)

    console.log('')
    console.log('── questionnaireEvents ──')
    console.log(JSON.stringify(sample.events, null, 2))
    console.log('')
    console.log('── questionnaireEventAnswers ──')
    console.log(JSON.stringify(sample.answers, null, 2))
    console.log('')
    console.log('── enhancedQuestionnairesPersons ──')
    console.log(JSON.stringify(sample.persons, null, 2))
    console.log('')
    console.log('── questionnaireQuestions ──')
    console.log(JSON.stringify(sample.questions, null, 2))
    console.log('')

    this.logger.success(
      `Fetched ${sample.events.length} events, ${sample.answers.length} answers, ${sample.persons.length} persons, ${sample.questions.length} questions`
    )
  }
}
