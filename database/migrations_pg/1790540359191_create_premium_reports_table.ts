import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'premium_reports'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.uuid('id').primary().notNullable().defaultTo(this.raw('uuidv7()'))
      table.uuid('club_id').notNullable().references('id').inTable('clubs').onDelete('CASCADE')
      table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE')
      table.string('title', 200).notNullable()
      table.date('date_from').notNullable()
      table.date('date_to').notNullable()
      table.jsonb('document').notNullable()
      table.jsonb('history').notNullable()
      table.timestamps(true, true)

      table.index(['club_id', 'updated_at'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
