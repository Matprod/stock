import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'nutrition_chatgptnutrition'

  public async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.string('name_fr', 300).nullable()
    })
  }

  public async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('name_fr')
    })
  }
} 