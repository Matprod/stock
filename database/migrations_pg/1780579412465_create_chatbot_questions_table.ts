import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'chatbot_questions'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.uuid('id').primary().notNullable().defaultTo(this.raw('uuidv7()'))

      table.string('title').notNullable()
      table.string('question').notNullable()
      table
        .enum('author', ['athlete', 'team', 'user'], {
          useNative: true,
          enumName: 'chatbot_question_author',
          existingType: false,
        })
        .notNullable()
        .defaultTo('athlete')
      table
        .enum('category', ['performance', 'injury'], {
          useNative: true,
          enumName: 'prediction_type_enum',
          existingType: true,
        })
        .notNullable()
      table.integer('order').notNullable().unsigned()

      table.uuid('club_id').references('id').inTable('clubs').onDelete('CASCADE').notNullable()

      table.timestamps(true, true)

      table.index(['club_id'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
    this.schema.raw('DROP TYPE IF EXISTS chatbot_question_author')
  }
}
