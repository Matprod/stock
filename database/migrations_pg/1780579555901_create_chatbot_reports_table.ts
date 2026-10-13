import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'chatbot_reports'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.uuid('id').primary().notNullable().defaultTo(this.raw('uuidv7()'))

      table.text('message').notNullable()
      table.text('summary').nullable()
      table.integer('score_at_generation').nullable()
      table
        .enum('category', ['performance', 'injury'], {
          useNative: true,
          enumName: 'prediction_type_enum',
          existingType: true,
        })
        .notNullable()
      table.uuid('day_id').references('id').inTable('days').onDelete('CASCADE').notNullable()

      table.timestamps(true, true)
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
