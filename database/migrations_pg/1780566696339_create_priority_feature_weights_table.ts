import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'priority_feature_weights'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.uuid('id').primary().notNullable().defaultTo(this.raw('uuidv7()'))

      table.uuid('club_id').references('id').inTable('clubs').onDelete('CASCADE').nullable()
      table
        .uuid('insight_id')
        .references('id')
        .inTable('insights')
        .onDelete('CASCADE')
        .notNullable()
      table
        .enum('type', ['performance', 'injury'], {
          useNative: true,
          enumName: 'prediction_type_enum',
          existingType: true,
        })
        .defaultTo('performance')
        .notNullable()

      table.timestamps(true, true)

      table.index(['club_id', 'insight_id'])
      table.unique(['club_id', 'insight_id', 'type'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
