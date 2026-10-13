import { TestHambourgService } from '#services/test_hambourg_service'
import { splitApiRow, transformExcelRowToApiRow } from '#services/hambourg/fbl_mapping'
import { BaseCommand, flags } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'

export default class HambourgPreviewApi extends BaseCommand {
  static commandName = 'hambourg:preview-api'
  static description = 'Preview Excel rows transformed to API naming'

  static options: CommandOptions = {
    startApp: false,
  }

  @flags.number({ description: 'Number of rows to preview', default: 3 })
  declare limit: number

  async run() {
    const { rows } = await new TestHambourgService().previewRows(this.limit)

    rows.forEach((excelRow, index) => {
      const apiRow = transformExcelRowToApiRow(excelRow)
      const { periodMetrics, context } = splitApiRow(apiRow)

      console.log(`\n── Row ${index + 1} — context (${Object.keys(context).length} fields)`)
      console.log(context)

      const metricPreview = Object.fromEntries(Object.entries(periodMetrics).slice(0, 8))
      console.log(
        `\n── Row ${index + 1} — period metrics sample (8/${Object.keys(periodMetrics).length})`
      )
      console.log(metricPreview)
    })
  }
}
