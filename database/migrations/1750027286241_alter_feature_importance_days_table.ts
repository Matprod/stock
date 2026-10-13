import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'feature_importances'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.bigInteger('day_id').notNullable().references('id').inTable('base_athleteday')
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('day_id')
    })
  }
}