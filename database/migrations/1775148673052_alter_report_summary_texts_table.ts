import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'chatbot_reports'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.text('summary').alter()
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.string('summary').alter()
    })
  }
}
