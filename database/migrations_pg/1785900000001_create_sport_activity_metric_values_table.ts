import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'sport_activity_metric_values'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.uuid('id').primary().notNullable().defaultTo(this.raw('uuidv7()'))

      table
        .uuid('sport_activity_id')
        .notNullable()
        .references('id')
        .inTable('sport_activities')
        .onDelete('CASCADE')
      table
        .uuid('metric_id')
        .notNullable()
        .references('id')
        .inTable('sport_activity_metrics')
        .onDelete('CASCADE')
      table.string('source').notNullable()
      table.string('value').notNullable()

      table.timestamps(true, true)

      table.unique(['sport_activity_id', 'metric_id', 'source'])
      table.index(['sport_activity_id', 'source'])
      table.index('source')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
