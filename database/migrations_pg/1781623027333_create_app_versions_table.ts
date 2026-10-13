import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'app_versions'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.uuid('id').primary().notNullable().defaultTo(this.raw('uuidv7()'))

      table.string('version').notNullable()
      table.enum('platform', ['ios', 'android']).notNullable()
      table.enum('status', ['development', 'published', 'suggest_update', 'required']).notNullable()
      table.text('update_message').nullable()

      table.timestamps(true, true)
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
