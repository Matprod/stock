import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'health_ratings'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.index(['day_id'], 'health_ratings_day_id_index')
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropIndex(['day_id'], 'health_ratings_day_id_index')
    })
  }
}
