import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'athlete_providers'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table.string('provider').nullable()
      table.integer('provider_athlete_id').nullable()
      table.bigInteger('athlete_id').references('id').inTable('base_athlete').onDelete('CASCADE')
      table.string('access_token').nullable()
      table.string('access_token_secret').nullable()
      table.string('refresh_token').nullable()

      table.timestamp('created_at')
      table.timestamp('updated_at')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}