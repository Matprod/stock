import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'chatbot_messages'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.uuid('id').primary().notNullable().defaultTo(this.raw('uuidv7()'))

      table.text('content').notNullable()
      table
        .enum('author', ['athlete', 'staff', 'bot'], {
          useNative: true,
          enumName: 'chatbot_message_author',
          existingType: false,
        })
        .notNullable()
      table
        .uuid('chatbot_discussion_id')
        .references('id')
        .inTable('chatbot_discussions')
        .onDelete('CASCADE')
        .notNullable()

      table.timestamps(true, true)
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
    this.schema.raw('DROP TYPE IF EXISTS chatbot_message_author')
  }
}
