import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'workout_session_instances'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.uuid('id').primary().notNullable().defaultTo(this.raw('uuidv7()'))

      table.dateTime('start_time').notNullable()
      table.integer('duration_seconds').nullable()
      table.string('title').notNullable()

      table
        .uuid('workout_session_id')
        .notNullable()
        .references('id')
        .inTable('workout_sessions')
        .onDelete('CASCADE')

      table.timestamps(true, true)
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
