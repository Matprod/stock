import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'athlete_providers'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.timestamp('token_expires_at').nullable()
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('token_expires_at')
    })
  }
}
