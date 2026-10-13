import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'demo_pairs'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table.text('question').notNullable()
      table.text('answer').notNullable()
      table.enum('category', ['performance', 'injury']).nullable()
      table.date('reference_date').nullable()
      table.boolean('is_active').notNullable().defaultTo(true)
      table.timestamps(true, true)
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
