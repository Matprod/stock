import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'health_metric_values'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')

      table
        .bigInteger('health_id')
        .notNullable()
        .references('id')
        .inTable('health_health')
        .onDelete('CASCADE')
      table
        .integer('metric_id')
        .unsigned()
        .references('id')
        .inTable('health_metrics')
        .onDelete('CASCADE')
      table.string('value').notNullable()

      table.timestamp('created_at')
      table.timestamp('updated_at')

      table.unique(['health_id', 'metric_id'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
