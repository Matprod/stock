import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'clubs'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('sleep_scale_max')
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.integer('sleep_scale_max').notNullable().defaultTo(10)
    })
  }
}
