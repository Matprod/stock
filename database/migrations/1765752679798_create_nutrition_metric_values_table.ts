import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'nutrition_metric_values'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')

      table
        .bigInteger('athlete_day_id')
        .notNullable()
        .references('id')
        .inTable('base_athleteday')
        .onDelete('CASCADE')

      table
        .integer('metric_id')
        .unsigned()
        .references('id')
        .inTable('nutrition_metrics')
        .onDelete('CASCADE')
      table.string('value').notNullable()

      table.timestamp('created_at')
      table.timestamp('updated_at')

      table.unique(['athlete_day_id', 'metric_id'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
