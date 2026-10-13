import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'chatbot_messages'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.json('chart_data').nullable()
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('chart_data')
    })
  }
}
