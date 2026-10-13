import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'base_athletedayavg'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.double('travel_fatigue').nullable()
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('travel_fatigue')
    })
  }
}
