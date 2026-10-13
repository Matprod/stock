import { BaseSchema } from '@adonisjs/lucid/schema';
export default class AddPlayerPositionToAthletes extends BaseSchema {
    tableName = 'base_athlete';
    async up() {
        this.schema.alterTable(this.tableName, (table) => {
            table.integer('player_position_id').unsigned().nullable();
            table.foreign('player_position_id').references('id').inTable('player_positions');
        });
    }
    async down() {
        this.schema.alterTable(this.tableName, (table) => {
            table.dropForeign('player_position_id');
            table.dropColumn('player_position_id');
        });
    }
}
//# sourceMappingURL=1744915717991_add_player_position_to_athletes.js.map