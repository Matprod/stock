import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'otp_codes'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.string('email').nullable()
      table.string('purpose').nullable()
      table.index(['email', 'purpose'])
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropIndex(['email', 'purpose'])
      table.dropColumn('email')
      table.dropColumn('purpose')
    })
  }
}
