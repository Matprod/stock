import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'feature_importances'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.uuid('id').primary().notNullable().defaultTo(this.raw('uuidv7()'))

      table.float('value').notNullable()
      table.float('optimal')
      table.float('shap_value')
      table
        .enum('type', ['activity', 'health', 'sleep', 'nutrition'], {
          useNative: true,
          enumName: 'entity_type_enum',
          existingType: false,
        })
        .notNullable()
      table
        .enum('category', ['performance', 'injury'], {
          useNative: true,
          enumName: 'prediction_type_enum',
          existingType: false,
        })
        .notNullable()
      table.float('contrib_pct').nullable()

      table
        .uuid('insight_id')
        .references('id')
        .inTable('insights')
        .onDelete('CASCADE')
        .notNullable()
      table.uuid('day_id').references('id').inTable('days').onDelete('CASCADE').notNullable()

      table.timestamps(true, true)

      table.index('insight_id')
      table.index('day_id')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
    this.schema.raw('DROP TYPE IF EXISTS entity_type_enum')
    this.schema.raw('DROP TYPE IF EXISTS prediction_type_enum')
  }
}
