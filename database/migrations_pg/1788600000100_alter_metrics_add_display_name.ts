import { BaseSchema } from '@adonisjs/lucid/schema'

const METRIC_TABLES = ['period_metrics', 'health_metrics', 'sport_activity_metrics'] as const

export default class extends BaseSchema {
  async up() {
    for (const tableName of METRIC_TABLES) {
      this.schema.alterTable(tableName, (table) => {
        table.string('display_name').nullable()
      })
    }
  }

  async down() {
    for (const tableName of METRIC_TABLES) {
      this.schema.alterTable(tableName, (table) => {
        table.dropColumn('display_name')
      })
    }
  }
}
