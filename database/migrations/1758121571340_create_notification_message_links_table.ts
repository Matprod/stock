import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'notification_message_links'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')

      table
        .integer('notification_id')
        .unsigned()
        .references('id')
        .inTable('notifications')
        .onDelete('CASCADE')
      table
        .integer('notification_message_id')
        .unsigned()
        .references('id')
        .inTable('notifications_messages')
        .onDelete('CASCADE')

      table.index(['notification_id', 'notification_message_id'], 'idx_notif_msg_links')
      table.unique(['notification_id', 'notification_message_id'], 'uniq_notif_msg_links')

      table.timestamp('created_at')
      table.timestamp('updated_at')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
