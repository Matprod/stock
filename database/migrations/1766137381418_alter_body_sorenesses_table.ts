import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'health_health'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.smallint('body_soreness_rating').unsigned().nullable()
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('body_soreness_rating')
    })
  }
}
