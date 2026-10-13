import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'biomarker_types'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.string('display_name').nullable()
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('display_name')
    })
  }
}
