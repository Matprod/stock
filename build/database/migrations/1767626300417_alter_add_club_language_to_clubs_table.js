import { BaseSchema } from '@adonisjs/lucid/schema';
export default class extends BaseSchema {
    tableName = 'clubs';
    async up() {
        this.schema.alterTable(this.tableName, (table) => {
            table.enum('club_language', ['en', 'fr']).nullable();
        });
    }
    async down() {
        this.schema.alterTable(this.tableName, (table) => {
            table.dropColumn('club_language');
        });
    }
}
//# sourceMappingURL=1767626300417_alter_add_club_language_to_clubs_table.js.map