import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'feature_importances'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.double('shap_value').nullable().alter()
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.float('shap_value').nullable().alter()
    })
  }
}
