import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'reinforcement_exercise_favorites'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table
        .integer('user_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('users')
        .onDelete('CASCADE')
      table
        .bigint('exercise_id')
        .notNullable()
        .references('id')
        .inTable('sportactivity_reinforcementexercices')
        .onDelete('CASCADE')

      table.timestamp('created_at')
      table.timestamp('updated_at')

      table.unique(['user_id', 'exercise_id'])
      table.index(['user_id'])
      table.index(['exercise_id'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
