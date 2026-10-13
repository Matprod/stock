import { BaseSchema } from '@adonisjs/lucid/schema'

export default class AddNutritionIdToFoodIntake extends BaseSchema {
  protected tableName = 'sportactivity_foodintake'

  public async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table
        .bigInteger('nutrition_id')
        .nullable()
        .references('id')
        .inTable('nutrition_nutrition')
        .onDelete('CASCADE')
    })
  }

  public async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropForeign(['nutrition_id'])
      table.dropColumn('nutrition_id')
    })
  }
}

