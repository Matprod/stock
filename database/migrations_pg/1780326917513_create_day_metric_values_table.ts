import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'day_metric_values'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.uuid('id').primary().notNullable().defaultTo(this.raw('uuidv7()'))

      table.uuid('day_id').notNullable().references('id').inTable('days').onDelete('CASCADE')
      table
        .uuid('metric_id')
        .notNullable()
        .references('id')
        .inTable('day_metrics')
        .onDelete('CASCADE')
      table.string('value').notNullable()

      table.timestamps(true, true)

      table.unique(['day_id', 'metric_id'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
