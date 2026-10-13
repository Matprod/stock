import { TestHambourgService } from '#services/test_hambourg_service'
import { BaseCommand, flags } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'

export default class HambourgImportRow extends BaseCommand {
  static commandName = 'hambourg:import-row'
  static description = 'Import N Excel rows as sport activities (STATSports test import)'

  static options: CommandOptions = {
    startApp: true,
  }

  @flags.number({ description: 'Number of Excel rows to import', default: 1 })
  declare limit: number

  async run() {
    const service = new TestHambourgService()

    const result = await service.importRowsInBatches({
      limit: this.limit,
      batchSize: 1,
      onBatchComplete: (progress) => {
        console.log(
          `Row ${progress.rowsProcessed}: ok=${progress.batchImported} fail=${progress.batchFailed}` +
            (progress.batchErrors.length > 0 ? ` — ${progress.batchErrors.at(-1)}` : '')
        )
      },
    })

    this.logger.success(`Done: ${result.imported} imported, ${result.failed} failed`)
  }
}
