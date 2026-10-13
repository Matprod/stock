import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'injury_types'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropUnique(['category_id', 'name'])
      table.uuid('club_id').nullable().references('id').inTable('clubs').onDelete('CASCADE')
      table.unique(['category_id', 'name', 'club_id'])
      table.index('club_id')
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropUnique(['category_id', 'name', 'club_id'])
      table.dropIndex(['club_id'])
      table.dropColumn('club_id')
      table.unique(['category_id', 'name'])
    })
  }
}
