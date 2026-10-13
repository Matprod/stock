import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'sleep_sleep'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.bigint('nap_am').nullable()
      table.bigint('nap_pm').nullable()
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('nap_am')
      table.dropColumn('nap_pm')
    })
  }
}
