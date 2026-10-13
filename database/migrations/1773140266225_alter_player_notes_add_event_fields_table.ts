import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'player_notes'

  public async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.string('category', 20).nullable().after('content')

      table
        .integer('event_id')
        .unsigned()
        .references('id')
        .inTable('events')
        .onDelete('SET NULL')
        .nullable()
        .after('athlete_id')
    })
  }

  public async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropForeign(['event_id'])
      table.dropColumn('event_id')
      table.dropColumn('category')
    })
  }
}
