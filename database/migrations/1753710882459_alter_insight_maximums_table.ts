import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'insights'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.float('maximum').nullable()
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('maximum')
    })
  }
}
