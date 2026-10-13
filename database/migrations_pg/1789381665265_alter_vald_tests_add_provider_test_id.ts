import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'vald_tests'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.string('provider_test_id').nullable().unique()
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropUnique(['provider_test_id'])
      table.dropColumn('provider_test_id')
    })
  }
}
