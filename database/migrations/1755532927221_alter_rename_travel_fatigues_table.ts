import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'base_athletedayavg'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.renameColumn('travel_fatigue', 'travel_fatigue_score')
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.renameColumn('travel_fatigue_score', 'travel_fatigue')
    })
  }
}
