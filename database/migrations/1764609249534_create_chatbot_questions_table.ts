import { BaseSchema } from '@adonisjs/lucid/schema'
import { CHATBOT_QUESTION_CATEGORY } from '#constants/chatbot_questions.constants'

export default class extends BaseSchema {
  protected tableName = 'chatbot_questions'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table.string('title').notNullable()
      table.string('question').notNullable()
      table.enum('category', Object.values(CHATBOT_QUESTION_CATEGORY))
      table.integer('order').notNullable()
      table.integer('club_id').unsigned().references('id').inTable('clubs').onDelete('CASCADE')

      table.timestamp('created_at')
      table.timestamp('updated_at')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
