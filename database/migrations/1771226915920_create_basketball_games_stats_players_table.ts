import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'basketball_games_stats_players'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table
        .integer('basketball_game_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('basketball_games')
        .onDelete('CASCADE')
      table.integer('api_player_id').unsigned().notNullable()
      table.integer('api_team_id').unsigned().nullable()
      table.string('player_name').nullable()
      table.string('type').nullable()
      table.string('minutes').nullable()

      table.integer('field_goals_total').nullable()
      table.integer('field_goals_attempts').nullable()
      table.integer('threepoint_goals_total').nullable()
      table.integer('threepoint_goals_attempts').nullable()
      table.integer('freethrows_goals_total').nullable()
      table.integer('freethrows_goals_attempts').nullable()
      table.integer('rebounds_total').nullable()
      table.integer('assists').nullable()
      table.integer('points').nullable()
      table.integer('plus_minus').nullable()

      table.timestamp('created_at')
      table.timestamp('updated_at')
      table.unique(['basketball_game_id', 'api_player_id'], 'bg_player_unique')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
