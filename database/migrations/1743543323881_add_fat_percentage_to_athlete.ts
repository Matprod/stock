import { BaseSchema } from '@adonisjs/lucid/schema'

export default class AddFatPercentageToAthlete extends BaseSchema {
  protected tableName = 'base_athlete'

  public async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.decimal('fat_percentage', 5, 2).nullable()
    })
  }

  public async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('fat_percentage')
    })
  }
} 