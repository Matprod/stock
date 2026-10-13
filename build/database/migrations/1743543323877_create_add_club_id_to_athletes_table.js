import { BaseSchema } from '@adonisjs/lucid/schema';
export default class extends BaseSchema {
    tableName = 'base_athlete';
    async up() {
        this.schema.alterTable(this.tableName, (table) => {
            table.integer('club_id').unsigned().references('id').inTable('clubs');
        });
    }
    async down() {
        this.schema.alterTable(this.tableName, (table) => {
            table.dropForeign(['club_id']);
            table.dropColumn('club_id');
        });
    }
}
//# sourceMappingURL=1743543323877_create_add_club_id_to_athletes_table.js.map