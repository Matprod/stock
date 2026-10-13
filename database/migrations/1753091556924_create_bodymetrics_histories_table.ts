import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'bodymetrics_histories'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')

      table.bigInteger('athlete_id').references('id').inTable('base_athlete').onDelete('CASCADE')
      table.bigInteger('day_id').notNullable().references('id').inTable('base_athleteday').onDelete('CASCADE')

      table.float('weight').nullable()
      table.float('fat_percentage').nullable()

      table.timestamp('created_at', { useTz: true })
      table.timestamp('updated_at', { useTz: true })
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}