import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'base_injuryhistory'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.string('mechanism').nullable()
      table.string('tissue').nullable()
      table.string('angle').nullable()
      table.string('pathology').nullable()
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('mechanism')
      table.dropColumn('tissue')
      table.dropColumn('angle')
      table.dropColumn('pathology')
    })
  }
}
