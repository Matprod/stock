import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'favorite_reinforcement_exercises'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.uuid('id').primary().notNullable().defaultTo(this.raw('uuidv7()'))

      table.uuid('user_id').references('id').inTable('users').onDelete('CASCADE').notNullable()
      table
        .uuid('exercise_id')
        .references('id')
        .inTable('reinforcement_exercises')
        .onDelete('CASCADE')
        .notNullable()

      table.timestamps(true, true)

      table.unique(['user_id', 'exercise_id'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
