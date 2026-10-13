import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'base_athlete'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.integer('jersey_number').nullable()
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('jersey_number')
    })
  }
}
