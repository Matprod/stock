import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'translations'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      // Add 'player_position' to translatable types
      table
        .enum('translatable_type', ['insight', 'player_position', 'notification_message'])
        .notNullable()
        .alter()

      // Add 'player_position_name' to translation keys
      table
        .enum('key', [
          'insight_name',
          'insight_description',
          'player_position_name',
          'notification_message_title',
          'notification_message_content',
        ])
        .notNullable()
        .alter()
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.enum('translatable_type', ['insight', 'player_position']).notNullable().alter()
      table
        .enum('key', ['insight_name', 'insight_description', 'player_position_name'])
        .notNullable()
        .alter()
    })
  }
}
