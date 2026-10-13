import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'black_list_activities'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')

      table.integer('club_id').unsigned().references('id').inTable('clubs').onDelete('CASCADE')
      table.bigint('activity_id').nullable().references('id').inTable('base_activity')
      table.timestamp('created_at')
      table.timestamp('updated_at')
      table.index(['club_id', 'activity_id'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
