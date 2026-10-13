import { METRIC_DATA_TYPE } from '#constants/metrics.constants'
import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'period_metrics'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')

      table.string('name').notNullable()
      table.string('description').nullable()
      table.string('unit').nullable()
      table.enum('data_type', Object.values(METRIC_DATA_TYPE)).notNullable()

      table.timestamp('created_at')
      table.timestamp('updated_at')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
