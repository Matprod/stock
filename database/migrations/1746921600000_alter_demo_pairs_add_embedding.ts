import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'demo_pairs'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.json('embedding').nullable()
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('embedding')
    })
  }
}
