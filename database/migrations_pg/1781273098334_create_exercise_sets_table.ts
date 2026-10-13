import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'exercise_sets'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.uuid('id').primary().notNullable().defaultTo(this.raw('uuidv7()'))

      table.integer('reps').nullable()
      table.float('weight').nullable()
      table.integer('duration_seconds').nullable()
      table.integer('order').nullable()
      table.integer('set_order').nullable()
      table
        .uuid('sport_activity_id')
        .references('id')
        .inTable('sport_activities')
        .onDelete('CASCADE')
        .nullable()
      table
        .uuid('exercise_id')
        .references('id')
        .inTable('reinforcement_exercises')
        .onDelete('CASCADE')
        .notNullable()
      table
        .uuid('workout_session_instance_id')
        .references('id')
        .inTable('workout_session_instances')
        .onDelete('CASCADE')
        .nullable()

      table.timestamps(true, true)

      table.index(['sport_activity_id', 'exercise_id'])
    })
  }
  async down() {
    this.schema.dropTable(this.tableName)
  }
}
