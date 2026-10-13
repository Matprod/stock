import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'translations'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      // Add 'chatbot_question' to translatable types
      table
        .enum('translatable_type', [
          'insight',
          'player_position',
          'notification_message',
          'chatbot_question',
        ])
        .notNullable()
        .alter()

      // Add chatbot question keys to translation keys
      table
        .enum('key', [
          'insight_name',
          'insight_description',
          'player_position_name',
          'notification_message_title',
          'notification_message_content',
          'chatbot_question_title',
          'chatbot_question_text',
        ])
        .notNullable()
        .alter()
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table
        .enum('translatable_type', ['insight', 'player_position', 'notification_message'])
        .notNullable()
        .alter()
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
}
