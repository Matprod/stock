import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'club_providers'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')

      table.integer('club_id').unsigned().references('id').inTable('clubs').onDelete('CASCADE')

      table.string('provider').notNullable()
      table.string('provider_team_id').nullable()
      table.text('access_token').nullable()
      table.text('access_token_secret').nullable()
      table.text('refresh_token').nullable()

      table.timestamp('token_expires_at').nullable()
      table.timestamp('last_synced_at').nullable()

      table.timestamp('created_at')
      table.timestamp('updated_at')

      table.unique(['club_id', 'provider'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
