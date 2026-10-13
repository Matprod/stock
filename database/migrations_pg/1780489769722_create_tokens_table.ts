import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'tokens'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.uuid('id').primary().notNullable().defaultTo(this.raw('uuidv7()'))

      table.text('access_token').notNullable()
      table.dateTime('access_expiration_date').notNullable()
      table.text('refresh_token').notNullable()
      table.dateTime('refresh_expiration_date').notNullable()

      table
        .uuid('athlete_id')
        .references('id')
        .inTable('athletes')
        .onDelete('CASCADE')
        .notNullable()

      table.timestamps(true, true)
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
