import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'vald_trials'

  public async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropForeign(['athlete_day_id'])
      table.dropColumn('athlete_day_id')
      table.integer('vald_test_id').unsigned().notNullable().references('id').inTable('vald_tests').onDelete('CASCADE')
    })
  }

  public async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('vald_test_id')
      table.bigInteger('athlete_day_id').notNullable().references('id').inTable('base_athleteday').onDelete('CASCADE')
    })
  }
}
