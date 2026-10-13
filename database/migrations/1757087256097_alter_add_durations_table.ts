import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'workout_sessions'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.integer('duration').nullable()
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('duration')
    })
  }
}
