import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'club_insights'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')

      table.integer('club_id').unsigned().references('id').inTable('clubs').onDelete('CASCADE')
      table
        .integer('insight_id')
        .unsigned()
        .references('id')
        .inTable('insights')
        .onDelete('CASCADE')

      table.index(['club_id', 'insight_id'])
      table.unique(['club_id', 'insight_id'])

      table.timestamp('created_at')
      table.timestamp('updated_at')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
