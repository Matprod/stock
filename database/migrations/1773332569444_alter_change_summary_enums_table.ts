import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'ai_summaries'

  public async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.enum('entity_type', ['activity', 'nutrition', 'sleep', 'health']).alter()
    })
  }

  public async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.enum('entity_type', ['activity', 'nutrition', 'sleep']).alter()
    })
  }
}
