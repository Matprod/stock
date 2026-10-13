import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'base_athlete'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.string('vald_profile_id').nullable()
      table.dateTime('vald_last_synced_at').nullable()
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('vald_profile_id')
      table.dropColumn('vald_last_synced_at')
    })
  }
}
