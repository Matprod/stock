import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'prompts'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.uuid('id').primary().notNullable().defaultTo(this.raw('uuidv7()'))

      table.string('title').notNullable()
      table.text('content').notNullable()

      table.uuid('club_id').references('id').inTable('clubs').onDelete('CASCADE').nullable()

      table.timestamps(true, true)

      table.index('club_id')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
