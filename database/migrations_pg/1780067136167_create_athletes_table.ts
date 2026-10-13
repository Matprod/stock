import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'athletes'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.uuid('id').primary().notNullable().defaultTo(this.raw('uuidv7()'))

      table.string('password').notNullable()
      table.string('first_name').notNullable()
      table.string('last_name').notNullable()
      table.string('email').notNullable().unique()
      table.date('birth_date').notNullable()
      table.integer('fc_max').nullable()
      table.integer('fc_min').nullable()
      table.integer('height_cm').notNullable()
      table.float('weight_kg').notNullable()
      table.decimal('fat_percentage', 5, 2).nullable()
      table
        .enum('gender', ['male', 'female'], {
          useNative: true,
          enumName: 'gender_enum',
          existingType: false,
        })
        .defaultTo('male')
      table.string('fcm_device_token').nullable()
      table.string('app_language').notNullable().defaultTo('en')
      table.date('start_date').notNullable()
      table.date('end_date').nullable()
      table.integer('jersey_number').nullable()

      table.uuid('club_id').notNullable().references('id').inTable('clubs').onDelete('CASCADE')
      table
        .uuid('player_position_id')
        .notNullable()
        .references('id')
        .inTable('player_positions')
        .onDelete('CASCADE')

      table.check('fc_max > 0', [], 'check_fc_max')
      table.check('fc_min >= 0 and fc_min < fc_max', [], 'check_fc_min')
      table.check('height_cm > 0', [], 'check_height_cm')
      table.check('weight_kg > 0', [], 'check_weight_kg')
      table.check('fat_percentage >= 0 and fat_percentage <= 100', [], 'check_fat_percentage')

      table.timestamps(true, true)
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
    this.schema.raw('DROP TYPE IF EXISTS gender_enum')
  }
}
