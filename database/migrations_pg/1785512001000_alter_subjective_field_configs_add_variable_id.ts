import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'subjective_field_configs'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table
        .uuid('subjective_variable_id')
        .nullable()
        .references('id')
        .inTable('subjective_variables')
        .onDelete('CASCADE')

      table.unique(['club_id', 'subjective_variable_id'])
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropUnique(['club_id', 'subjective_variable_id'])
      table.dropColumn('subjective_variable_id')
    })
  }
}
