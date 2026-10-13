import { BaseSchema } from '@adonisjs/lucid/schema';
export default class extends BaseSchema {
    tableName = 'events';
    async up() {
        this.schema.alterTable(this.tableName, (table) => {
            table.string('travel_type', 20).nullable();
        });
    }
    async down() {
        this.schema.alterTable(this.tableName, (table) => {
            table.dropColumn('travel_type');
        });
    }
}
//# sourceMappingURL=1769713795911_add_travel_type_to_events_table.js.map