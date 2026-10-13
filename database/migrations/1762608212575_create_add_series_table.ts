import { DATA_TYPE } from '#constants/serie.constants'
import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'series'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')

      table.string('type').notNullable()
      table.text('data_encoded', 'longtext').notNullable()
      table.integer('samples_per_minute').unsigned().defaultTo(60).notNullable()
      table.enum('data_type', Object.values(DATA_TYPE)).defaultTo(DATA_TYPE.UNSIGNED).notNullable()
      table.tinyint('bits').unsigned().defaultTo(8).notNullable()

      table
        .integer('period_id')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('periods')
        .onDelete('CASCADE')

      table.timestamp('created_at')
      table.timestamp('updated_at')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
