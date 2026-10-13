import { BaseSchema } from '@adonisjs/lucid/schema';
export default class extends BaseSchema {
    tableName = 'basketball_game_player_stats';
    async up() {
        this.schema.createTable(this.tableName, (table) => {
            table.uuid('id').primary().notNullable().defaultTo(this.raw('uuidv7()'));
            table
                .uuid('basketball_game_id')
                .references('id')
                .inTable('basketball_games')
                .onDelete('CASCADE')
                .notNullable();
            table.integer('api_player_id').notNullable();
            table.integer('api_team_id').nullable();
            table.string('player_name').nullable();
            table.string('type').nullable();
            table.string('minutes').nullable();
            table.integer('field_goals_total').nullable();
            table.integer('field_goals_attempts').nullable();
            table.integer('threepoint_goals_total').nullable();
            table.integer('threepoint_goals_attempts').nullable();
            table.integer('freethrows_goals_total').nullable();
            table.integer('freethrows_goals_attempts').nullable();
            table.integer('rebounds_total').nullable();
            table.integer('assists').nullable();
            table.integer('points').nullable();
            table.integer('plus_minus').nullable();
            table.timestamps(true, true);
            table.unique(['basketball_game_id', 'api_player_id']);
            table.index('basketball_game_id');
        });
    }
    async down() {
        this.schema.dropTable(this.tableName);
    }
}
//# sourceMappingURL=1780558646769_create_basketball_players_stats_table.js.map