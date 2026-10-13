import { BaseSchema } from '@adonisjs/lucid/schema'
export default class extends BaseSchema {
  protected tableName = 'exercise_loads'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.uuid('id').primary().notNullable().defaultTo(this.raw('uuidv7()'))

      table
        .uuid('athlete_id')
        .references('id')
        .inTable('athletes')
        .onDelete('CASCADE')
        .notNullable()
      table
        .uuid('sport_activity_id')
        .references('id')
        .inTable('sport_activities')
        .onDelete('CASCADE')
        .notNullable()
      table.float('gear_load_kg').nullable()
      table.float('weapon_load_kg').nullable()

      table.index(['athlete_id', 'sport_activity_id'])

      table.timestamps(true, true)
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
