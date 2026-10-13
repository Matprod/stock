import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'notification_message_links'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.uuid('id').primary().notNullable().defaultTo(this.raw('uuidv7()'))

      table
        .uuid('notification_id')
        .notNullable()
        .references('id')
        .inTable('notifications')
        .onDelete('CASCADE')
      table
        .uuid('notification_message_id')
        .notNullable()
        .references('id')
        .inTable('notification_messages')
        .onDelete('CASCADE')

      table.timestamps(true, true)
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
