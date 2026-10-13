import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'injuries'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table
        .enum('contact_type', ['no_contact', 'contact', 'semi_contact'], {
          useNative: true,
          enumName: 'injury_contact_type_enum',
          existingType: false,
        })
        .nullable()
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('contact_type')
    })
    this.schema.raw('DROP TYPE IF EXISTS injury_contact_type_enum')
  }
}
