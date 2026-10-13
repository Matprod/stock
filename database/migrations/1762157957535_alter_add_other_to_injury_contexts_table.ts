import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'base_injuryhistory'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.enum('context', ['match', 'training', 'other']).nullable().alter()
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.enum('context', ['match', 'training']).nullable().alter()
    })
  }
}