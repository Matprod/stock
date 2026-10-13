import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'days'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.integer('performance_score_test').nullable()
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('performance_score_test')
    })
  }
}
