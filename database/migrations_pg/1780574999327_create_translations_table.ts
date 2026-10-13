import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'translations'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.uuid('id').primary().notNullable().defaultTo(this.raw('uuidv7()'))

      table
        .enum('language', ['fr', 'en'], {
          useNative: true,
          enumName: 'language_enum',
          existingType: true,
        })
        .notNullable()
      table.string('translatable_type').notNullable()
      table.uuid('translatable_id').notNullable()
      table.string('key').notNullable()
      table.text('value').notNullable()

      table.timestamps(true, true)
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
