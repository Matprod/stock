import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'subjective_field_configs'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.integer('gap').nullable()
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('gap')
    })
  }
}
