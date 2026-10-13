import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'biomarker_types'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.uuid('id').primary().notNullable().defaultTo(this.raw('uuidv7()'))
      table.string('name').notNullable()
      table.string('unit').notNullable()
      table.timestamps(true, true)
    })

    this.schema.createTable('biomarker_type_clubs', (table) => {
      table.uuid('id').primary().notNullable().defaultTo(this.raw('uuidv7()'))

      table
        .uuid('biomarker_type_id')
        .notNullable()
        .references('id')
        .inTable('biomarker_types')
        .onDelete('CASCADE')
      table.uuid('club_id').notNullable().references('id').inTable('clubs').onDelete('CASCADE')

      table.timestamps(true, true)
      table.unique(['biomarker_type_id', 'club_id'])
    })
  }

  async down() {
    this.schema.dropTable('biomarker_type_clubs')
    this.schema.dropTable(this.tableName)
  }
}
