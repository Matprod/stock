import { BaseSchema } from '@adonisjs/lucid/schema';
export default class extends BaseSchema {
    tableName = 'basketball_games_stats';
    async up() {
        this.schema.createTable(this.tableName, (table) => {
            table.increments('id');
            table
                .integer('basketball_game_id')
                .unsigned()
                .notNullable()
                .unique()
                .references('id')
                .inTable('basketball_games')
                .onDelete('CASCADE');
            table.integer('home_field_goals_total').nullable();
            table.integer('home_field_goals_attempts').nullable();
            table.integer('home_threepoint_goals_total').nullable();
            table.integer('home_threepoint_goals_attempts').nullable();
            table.integer('home_freethrows_goals_total').nullable();
            table.integer('home_freethrows_goals_attempts').nullable();
            table.integer('home_rebounds_total').nullable();
            table.integer('home_rebounds_offence').nullable();
            table.integer('home_rebounds_defense').nullable();
            table.integer('home_assists').nullable();
            table.integer('home_steals').nullable();
            table.integer('home_blocks').nullable();
            table.integer('home_turnovers').nullable();
            table.integer('home_personal_fouls').nullable();
            table.integer('away_field_goals_total').nullable();
            table.integer('away_field_goals_attempts').nullable();
            table.integer('away_threepoint_goals_total').nullable();
            table.integer('away_threepoint_goals_attempts').nullable();
            table.integer('away_freethrows_goals_total').nullable();
            table.integer('away_freethrows_goals_attempts').nullable();
            table.integer('away_rebounds_total').nullable();
            table.integer('away_rebounds_offence').nullable();
            table.integer('away_rebounds_defense').nullable();
            table.integer('away_assists').nullable();
            table.integer('away_steals').nullable();
            table.integer('away_blocks').nullable();
            table.integer('away_turnovers').nullable();
            table.integer('away_personal_fouls').nullable();
            table.timestamp('created_at');
            table.timestamp('updated_at');
        });
    }
    async down() {
        this.schema.dropTable(this.tableName);
    }
}
//# sourceMappingURL=1771221331547_create_basketball_games_stats_table.js.map