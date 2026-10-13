import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'base_injuryhistory'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.enum('context', ['match', 'training']).nullable()
      table.text('note').nullable()
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('context')
      table.dropColumn('note')
    })
  }
}