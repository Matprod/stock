import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'insights'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.float('treshold_low').nullable()
      table.float('treshold_too_low').nullable()
      table.float('treshold_high').nullable()
      table.float('treshold_too_high').nullable()
      table.enum('treshold_type', ['PERCENTAGE', 'ABSOLUTE']).nullable()
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('treshold_low')
      table.dropColumn('treshold_too_low')
      table.dropColumn('treshold_high')
      table.dropColumn('treshold_too_high')
      table.dropColumn('treshold_type')
    })
  }
}
