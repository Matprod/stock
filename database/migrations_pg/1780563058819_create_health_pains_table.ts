import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'health_pains'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.uuid('id').primary().notNullable().defaultTo(this.raw('uuidv7()'))

      table.integer('rating').notNullable()

      table
        .uuid('health_id')
        .references('id')
        .inTable('health_ratings')
        .onDelete('CASCADE')
        .notNullable()
      table
        .uuid('location_id')
        .references('id')
        .inTable('pain_discomfort_locations')
        .onDelete('CASCADE')
        .notNullable()

      table.timestamps(true, true)
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
