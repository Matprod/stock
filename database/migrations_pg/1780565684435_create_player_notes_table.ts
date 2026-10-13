import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'player_notes'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.uuid('id').primary().notNullable().defaultTo(this.raw('uuidv7()'))

      table.enum('category', ['training', 'matches', 'medical', 'travel'], {
        useNative: true,
        enumName: 'event_category_enum',
        existingType: true,
      })
      table.text('content').notNullable()
      table.date('note_date').notNullable()

      table
        .uuid('athlete_id')
        .references('id')
        .inTable('athletes')
        .onDelete('CASCADE')
        .notNullable()
      table.uuid('event_id').references('id').inTable('events').onDelete('CASCADE').nullable()

      table.timestamps(true, true)
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
