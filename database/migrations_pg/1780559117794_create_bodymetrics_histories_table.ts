import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'bodymetrics_histories'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.uuid('id').primary().notNullable().defaultTo(this.raw('uuidv7()'))

      table.float('weight').nullable()
      table.float('fat_percentage').nullable()
      table
        .uuid('athlete_id')
        .references('id')
        .inTable('athletes')
        .onDelete('CASCADE')
        .notNullable()
      table.uuid('day_id').references('id').inTable('days').onDelete('CASCADE').notNullable()

      table.timestamps(true, true)

      table.index('athlete_id')
      table.index('day_id')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
