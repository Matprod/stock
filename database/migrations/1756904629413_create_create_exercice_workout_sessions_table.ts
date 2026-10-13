import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'exercice_workout_session'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table
        .integer('workout_session_id')
        .unsigned()
        .references('id')
        .inTable('workout_sessions')
        .onDelete('CASCADE')
      table
        .bigint('exercice_id')
        .references('id')
        .inTable('sportactivity_reinforcementexercices')
        .onDelete('CASCADE')
      table.timestamp('created_at')
      table.timestamp('updated_at')

      table.index(['exercice_id', 'workout_session_id'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
