import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'notification_athletes'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.uuid('id').primary().notNullable().defaultTo(this.raw('uuidv7()'))

      table
        .uuid('athlete_id')
        .notNullable()
        .references('id')
        .inTable('athletes')
        .onDelete('CASCADE')
      table
        .uuid('notification_id')
        .notNullable()
        .references('id')
        .inTable('notifications')
        .onDelete('CASCADE')

      table.timestamps(true, true)

      table.index(['notification_id', 'athlete_id'])
      table.unique(['notification_id', 'athlete_id'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
