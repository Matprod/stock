import { BaseSchema } from '@adonisjs/lucid/schema'

export default class MakeFoodIdNullableInFoodIntake extends BaseSchema {
  protected tableName = 'sportactivity_foodintake'

  public async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.bigInteger('food_id').nullable().alter()
    })
  }

  public async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.bigInteger('food_id').notNullable().alter()
    })
  }
}

