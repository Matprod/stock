import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'base_athletedayavg'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.renameColumn('avgCarbohydrate', 'avg_carbohydrate')
      table.double('sleep_quality_variability').nullable()
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.renameColumn('avg_carbohydrate', 'avgCarbohydrate')
      table.dropColumn('sleep_quality_variability')
    })
  }
}
