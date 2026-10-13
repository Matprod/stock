import { BaseSchema } from '@adonisjs/lucid/schema'

export default class AddChatGPTFoodToAthleteFavoriteFood extends BaseSchema {
  protected tableName = 'nutrition_athletefavoritefood'

  public async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table
        .integer('chatgpt_food_id')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('nutrition_chatgptnutrition')
        .onDelete('CASCADE')
    })
  }

  public async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropForeign(['chatgpt_food_id'])
      table.dropColumn('chatgpt_food_id')
    })
  }
}

