import { ATHLETE_PROVIDER_SOURCE } from '#constants/athlete_provider.constants'
import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'diseases'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.string('source').notNullable().defaultTo(ATHLETE_PROVIDER_SOURCE.MANUAL)
      table.string('name').notNullable().defaultTo('')
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('source')
      table.dropColumn('name')
    })
  }
}
