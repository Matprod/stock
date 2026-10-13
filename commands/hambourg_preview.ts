import { TestHambourgService } from '#services/test_hambourg_service'
import { BaseCommand, flags } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'

export default class HambourgPreview extends BaseCommand {
  static commandName = 'hambourg:preview'
  static description = 'Preview Statssports Input FBL rows from stats-sports.xlsx'

  static options: CommandOptions = {
    startApp: false,
  }

  @flags.number({ description: 'Number of rows to preview', default: 10 })
  declare limit: number

  async run() {
    const { columns, rows } = await new TestHambourgService().previewRows(this.limit)

    this.logger.info(`Columns (${columns.length}): ${columns.join(' | ')}\n`)
    rows.forEach((row, index) => console.log(`Row ${index + 1}:`, row))
  }
}
