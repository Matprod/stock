import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'diseases'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropForeign(['type_of_disease_id'])
      table.dropColumn('type_of_disease_id')
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table
        .integer('type_of_disease_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('disease_types')
        .onDelete('CASCADE')
    })
  }
}
