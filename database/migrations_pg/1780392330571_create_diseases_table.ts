import { ATHLETE_PROVIDER_SOURCE } from '#constants/athlete_provider.constants'
import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'diseases'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.uuid('id').primary().notNullable().defaultTo(this.raw('uuidv7()'))

      table.date('start_date').nullable()
      table.date('end_date').nullable()
      table.string('source').notNullable().defaultTo(ATHLETE_PROVIDER_SOURCE.MANUAL)
      table.string('name').notNullable()
      table.text('note').nullable()

      table
        .uuid('athlete_id')
        .notNullable()
        .references('id')
        .inTable('athletes')
        .onDelete('CASCADE')
      table
        .uuid('disease_type_id')
        .notNullable()
        .references('id')
        .inTable('disease_types')
        .onDelete('CASCADE')

      table.timestamps(true, true)
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
