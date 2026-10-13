import HsvPerformanceService from '#services/hsv_performance_service'
import { HSV_WELLNESS_START } from '#constants/hsv.constants'
import { BaseCommand, flags } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'

export default class HsvImport extends BaseCommand {
  static commandName = 'hsv:import'
  static description =
    'Import HSV wellness (Likert 1-6 stored as 10-60) for Hamburg'

  static options: CommandOptions = {
    startApp: true,
  }

  @flags.string({ description: `From ISO date (default ${HSV_WELLNESS_START})` })
  declare from: string | undefined

  @flags.string({ description: 'To ISO date (default today, UTC)' })
  declare to: string | undefined

  @flags.boolean({ description: 'Fetch and match players without writing', default: false })
  declare dryRun: boolean

  async run() {
    const result = await HsvPerformanceService.fromEnv().importAll({
      from: this.from,
      to: this.to,
      dryRun: this.dryRun,
    })

    this.logger.info(
      `Wellness ${result.from} → ${result.to}: ${result.rows} rows, ${result.upserted} upserted, ${result.skippedEmpty} empty skipped`
    )

    if (result.ignored.length > 0) {
      this.logger.info(`Ignored: ${result.ignored.join(', ')}`)
    }
    if (result.ambiguous.length > 0) {
      this.logger.warning(`Ambiguous: ${result.ambiguous.join(', ')}`)
    }
    if (result.missing.length > 0) {
      this.logger.warning(`Not in club athletes (${result.missing.length}):`)
      for (const name of result.missing) {
        this.logger.warning(`  ${name}`)
      }
    }
    if (result.withoutSap.length > 0) {
      this.logger.warning(
        `Matched but missing SAP PersonId — skipped for ML (${result.withoutSap.length}):`
      )
      for (const name of result.withoutSap) {
        this.logger.warning(`  ${name}`)
      }
    }

    if (result.dryRun) {
      this.logger.success('Dry run, nothing written')
      return
    }

    this.logger.success(`Upserted ${result.upserted} wellness day(s)`)
  }
}
