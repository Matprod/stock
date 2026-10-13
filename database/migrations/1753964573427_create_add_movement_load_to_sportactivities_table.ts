import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'sportactivity_sportactivity'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.float('movement_load').nullable()
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('movement_load')
    })
  }
}