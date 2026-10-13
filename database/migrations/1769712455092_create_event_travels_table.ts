import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'health_travel'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table
        .integer('event_id')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('events')
        .onDelete('CASCADE')
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropForeign(['event_id'])
      table.dropColumn('event_id')
    })
  }
}
