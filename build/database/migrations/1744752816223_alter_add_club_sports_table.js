import { BaseSchema } from '@adonisjs/lucid/schema';
export default class extends BaseSchema {
    tableName = 'clubs';
    async up() {
        this.schema.alterTable(this.tableName, (table) => {
            table.bigint('sport_id').references('id').inTable('base_sport');
        });
    }
    async down() {
        this.schema.alterTable(this.tableName, (table) => {
            table.dropForeign('sport_id');
            table.dropColumn('sport_id');
        });
    }
}
//# sourceMappingURL=1744752816223_alter_add_club_sports_table.js.map