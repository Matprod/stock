import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'nutritions'

  public async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.uuid('id').primary().notNullable().defaultTo(this.raw('uuidv7()'))

      table.string('meal_type').notNullable()

      table.decimal('quantity', 10, 2).notNullable()
      table.decimal('portion', 10, 2).nullable()

      table.uuid('day_id').notNullable().references('id').inTable('days').onDelete('CASCADE')
      table.uuid('llm_aliment_id').references('id').inTable('llm_aliments').onDelete('CASCADE')
      table.uuid('aliment_id').references('id').inTable('aliments').onDelete('CASCADE')
      table.uuid('recipe_id').references('id').inTable('recipes').onDelete('CASCADE')

      table.check(
        '(llm_aliment_id IS NOT NULL OR aliment_id IS NOT NULL OR recipe_id IS NOT NULL)',
        [],
        'check_source'
      )

      table.timestamps(true, true)
    })
  }
}
