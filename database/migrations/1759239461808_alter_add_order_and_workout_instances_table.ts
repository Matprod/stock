import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'sportactivity_exerciseset'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.integer('order').nullable()
      table.bigint('sport_activity_id').nullable().alter()
      table
        .integer('workout_session_instance_id')
        .unsigned()
        .references('id')
        .inTable('workout_session_instances')
        .onDelete('CASCADE')
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropForeign(['workout_session_instance_id'])
      table.dropColumn('workout_session_instance_id')
      table.dropColumn('order')
      table.bigint('sport_activity_id').notNullable().alter()
    })
  }
}
