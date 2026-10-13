import { STATSSPORTS_PERIOD_METRIC_DEFS } from '#constants/statsports.constants'
import PeriodMetric from '#models_pg/period_metric'
import { BaseCommand, flags } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'

export default class HambourgSeedMetrics extends BaseCommand {
  static commandName = 'hambourg:seed-metrics'
  static description = 'Create period_metrics rows for STATSports KPI columns'

  static options: CommandOptions = {
    startApp: true,
  }

  @flags.boolean({ description: 'List metrics without writing to DB' })
  declare dryRun: boolean

  async run() {
    const entries = Object.entries(STATSSPORTS_PERIOD_METRIC_DEFS)

    this.logger.info(`${entries.length} STATSports KPI metrics to seed`)

    let created = 0
    let updated = 0
    let unchanged = 0

    for (const [name, def] of entries) {
      const payload = {
        name,
        description: null as string | null,
        unit: null as string | null,
        dataType: def.dataType,
        aggregationMethod: def.aggregationMethod,
      }

      if (this.dryRun) {
        this.logger.info(`  ${name} (${def.dataType}, ${def.aggregationMethod})`)
        continue
      }

      const existingMetric = await PeriodMetric.findBy('name', name)

      if (existingMetric) {
        if (
          existingMetric.dataType !== def.dataType ||
          existingMetric.aggregationMethod !== def.aggregationMethod
        ) {
          existingMetric.dataType = def.dataType
          existingMetric.aggregationMethod = def.aggregationMethod
          await existingMetric.save()
          updated++
        } else {
          unchanged++
        }
        continue
      }

      await PeriodMetric.create(payload)
      created++
    }

    if (this.dryRun) return

    this.logger.success(`Done: ${created} created, ${updated} updated, ${unchanged} unchanged`)
  }
}
