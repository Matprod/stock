import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'sport_activity_pains'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.uuid('id').primary().notNullable().defaultTo(this.raw('uuidv7()'))

      table.integer('rating').notNullable()
      table
        .uuid('location_id')
        .references('id')
        .inTable('pain_discomfort_locations')
        .onDelete('CASCADE')
        .notNullable()
      table
        .uuid('sport_activity_id')
        .references('id')
        .inTable('sport_activities')
        .onDelete('CASCADE')
        .notNullable()

      table.timestamps(true, true)
    })
  }
  async down() {
    this.schema.dropTable(this.tableName)
  }
}
