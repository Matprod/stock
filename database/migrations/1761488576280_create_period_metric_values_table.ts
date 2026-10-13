import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'period_metric_values'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')

      table.integer('period_id').unsigned().references('id').inTable('periods').onDelete('CASCADE')
      table
        .integer('metric_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('period_metrics')
        .onDelete('CASCADE')
      table.string('value').notNullable()

      table.timestamp('created_at')
      table.timestamp('updated_at')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
