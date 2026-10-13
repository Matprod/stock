import { BaseSchema } from '@adonisjs/lucid/schema';
export default class AddExternalPlayerIdToAthletesTable extends BaseSchema {
    tableName = 'base_athlete';
    async up() {
        this.schema.alterTable(this.tableName, (table) => {
            table.string('my_coach_player_id').nullable();
        });
    }
    async down() {
        this.schema.alterTable(this.tableName, (table) => {
            table.dropColumn('my_coach_player_id');
        });
    }
}
//# sourceMappingURL=1743543323879_add_external_player_id_to_athletes_table.js.map