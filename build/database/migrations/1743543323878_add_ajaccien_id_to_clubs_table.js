import { BaseSchema } from '@adonisjs/lucid/schema';
export default class AddExternalClubIdToClubsTable extends BaseSchema {
    tableName = 'clubs';
    async up() {
        this.schema.alterTable(this.tableName, (table) => {
            table.string('my_coach_club_id').nullable();
        });
    }
    async down() {
        this.schema.alterTable(this.tableName, (table) => {
            table.dropColumn('my_coach_club_id');
        });
    }
}
//# sourceMappingURL=1743543323878_add_ajaccien_id_to_clubs_table.js.map