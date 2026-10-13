import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'favorite_aliments'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.uuid('id').primary().notNullable().defaultTo(this.raw('uuidv7()'))

      table.specificType('meal_types', 'varchar[]').notNullable()

      table
        .uuid('athlete_id')
        .references('id')
        .inTable('athletes')
        .onDelete('CASCADE')
        .notNullable()
      table.uuid('aliment_id').references('id').inTable('aliments').onDelete('CASCADE')
      table.uuid('llm_aliment_id').references('id').inTable('llm_aliments').onDelete('CASCADE')

      table.timestamps(true, true)
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
