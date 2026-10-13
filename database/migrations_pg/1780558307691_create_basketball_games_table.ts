import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'basketball_games'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.uuid('id').primary().notNullable().defaultTo(this.raw('uuidv7()'))

      table.uuid('club_id').references('id').inTable('clubs').onDelete('CASCADE').notNullable()
      table.uuid('event_id').references('id').inTable('events').onDelete('SET NULL')
      table.integer('api_game_id').notNullable()
      table.datetime('start_time').notNullable()
      table.datetime('end_time').notNullable()
      table.bigint('timestamp').notNullable()
      table.string('title').notNullable()
      table.string('location').nullable()
      table.string('status_short').nullable()
      table.integer('league_id').nullable()
      table.string('league_name').nullable()
      table.string('league_season').nullable()
      table.string('league_logo').nullable()
      table.integer('home_team_id').notNullable()
      table.string('home_team_name').notNullable()
      table.integer('away_team_id').notNullable()
      table.string('away_team_name').notNullable()
      table.integer('home_score_q1').nullable()
      table.integer('home_score_q2').nullable()
      table.integer('home_score_q3').nullable()
      table.integer('home_score_q4').nullable()
      table.integer('home_score_ot').nullable()
      table.integer('home_score_total').nullable()
      table.integer('away_score_q1').nullable()
      table.integer('away_score_q2').nullable()
      table.integer('away_score_q3').nullable()
      table.integer('away_score_q4').nullable()
      table.integer('away_score_ot').nullable()
      table.integer('away_score_total').nullable()

      table.timestamps(true, true)

      table.index('club_id')
      table.index('event_id')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
