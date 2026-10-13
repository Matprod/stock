import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'club_insights'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.uuid('id').primary().notNullable().defaultTo(this.raw('uuidv7()'))

      table.uuid('club_id').references('id').inTable('clubs').onDelete('CASCADE').notNullable()
      table
        .uuid('insight_id')
        .references('id')
        .inTable('insights')
        .onDelete('CASCADE')
        .notNullable()

      table.timestamps(true, true)

      table.unique(['club_id', 'insight_id'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
