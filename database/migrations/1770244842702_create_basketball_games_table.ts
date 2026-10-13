import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'basketball_games'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')

      table
        .integer('club_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('clubs')
        .onDelete('CASCADE')

      table
        .integer('event_id')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('events')
        .onDelete('SET NULL')

      table.integer('api_game_id').unsigned().notNullable()

      table.dateTime('start_time', { useTz: true }).notNullable()
      table.dateTime('end_time', { useTz: true }).notNullable()
      table.bigInteger('timestamp').notNullable()
      // Game info
      table.string('title').notNullable()
      table.string('location').nullable()

      table.string('status_short').nullable() // NS, Q1, Q2, Q3, Q4, OT, BT, HT, FT, AOT, POST, CANC, SUSP, AWD, ABD

      table.integer('league_id').unsigned().nullable()
      table.string('league_name').nullable()
      table.string('league_season').nullable()
      table.string('league_logo').nullable()

      // Teams
      table.integer('home_team_id').unsigned().notNullable()
      table.string('home_team_name').notNullable()
      table.integer('away_team_id').unsigned().notNullable()
      table.string('away_team_name').notNullable()

      // Scores
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

      table.timestamp('created_at')
      table.timestamp('updated_at')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
