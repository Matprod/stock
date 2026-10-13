import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'period_metric_values'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.unique(['period_id', 'metric_id'])
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropUnique(['period_id', 'metric_id'])
    })
  }
}
