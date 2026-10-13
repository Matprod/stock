import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'insights'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.text('description').alter()
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.string('description', 255).alter()
    })
  }
}