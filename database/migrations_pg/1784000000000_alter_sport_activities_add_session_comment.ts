import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'sport_activities'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.text('session_comment').nullable()
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('session_comment')
    })
  }
}
