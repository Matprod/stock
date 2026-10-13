import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'base_injuryhistory'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.date('recovery_date').nullable()
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('recovery_date')
    })
  }
}