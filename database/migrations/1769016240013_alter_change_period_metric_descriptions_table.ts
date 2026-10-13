import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'period_metrics'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.text('description').nullable().alter()
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.string('description').nullable().alter()
    })
  }
}