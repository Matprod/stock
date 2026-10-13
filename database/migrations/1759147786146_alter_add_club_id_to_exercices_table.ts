import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'sportactivity_reinforcementexercices'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.integer('club_id').unsigned().references('id').inTable('clubs').onDelete('CASCADE')
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('club_id')
    })
  }
}
