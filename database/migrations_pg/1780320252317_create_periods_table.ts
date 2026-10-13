import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'periods'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.uuid('id').primary().notNullable().defaultTo(this.raw('uuidv7()'))

      table.string('name').nullable()
      table.string('provider_id').nullable()
      table.datetime('start_time').nullable()
      table.datetime('end_time').nullable()

      table
        .uuid('sport_activity_id')
        .notNullable()
        .references('id')
        .inTable('sport_activities')
        .onDelete('CASCADE')

      table.timestamps(true, true)

      table.check('start_time < end_time', [], 'check_start_time_before_end_time')

      table.unique(['sport_activity_id', 'start_time', 'end_time'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
