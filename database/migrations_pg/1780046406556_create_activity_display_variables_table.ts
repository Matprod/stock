import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'activity_display_variables'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.uuid('id').primary().notNullable().defaultTo(this.raw('uuidv7()'))

      table.string('unit').nullable()
      table
        .uuid('activity_id')
        .notNullable()
        .references('id')
        .inTable('activities')
        .onDelete('CASCADE')
      table
        .uuid('display_variable_id')
        .notNullable()
        .references('id')
        .inTable('display_variables')
        .onDelete('CASCADE')

      table.uuid('club_id').nullable().references('id').inTable('clubs').onDelete('CASCADE')
      table.timestamps(true, true)

      table.unique(['activity_id', 'display_variable_id', 'club_id'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
