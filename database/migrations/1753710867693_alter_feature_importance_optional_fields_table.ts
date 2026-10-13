import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'feature_importances'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.float('optimal').nullable().alter()
      table.float('shap_value').nullable().alter()
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.float('optimal').notNullable().alter()
      table.float('shap_value').notNullable().alter()
    })
  }
}
