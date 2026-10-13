import { BaseSchema } from '@adonisjs/lucid/schema'
import { USER_ROLE } from '#constants/user.constants'
export default class extends BaseSchema {
  protected tableName = 'users'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.enum('role', Object.values(USER_ROLE)).defaultTo(USER_ROLE.CLUB_STAFF)
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('role')
    })
  }
}
