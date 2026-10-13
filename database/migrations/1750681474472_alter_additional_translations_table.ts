import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'translations'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.enum('translatable_type', ['insight', 'player_position']).notNullable().alter()
      table
        .enum('key', ['insight_name', 'insight_description', 'player_position_name'])
        .notNullable()
        .alter()
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.enum('translatable_type', ['insight']).notNullable().alter()
      table.enum('key', ['insight_name', 'insight_description']).notNullable().alter()
    })
  }
}
