import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'health_metrics'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.uuid('id').primary().notNullable().defaultTo(this.raw('uuidv7()'))

      table.string('name').notNullable().unique()
      table.text('description').nullable()
      table.string('unit').nullable()
      table
        .enum('data_type', ['float', 'integer', 'string', 'boolean'], {
          useNative: true,
          enumName: 'data_type_enum',
          existingType: true,
        })
        .notNullable()

      table.timestamps(true, true)
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
