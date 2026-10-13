import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'chatbot_reports'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.string('summary').nullable()
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('summary')
    })
  }
}
