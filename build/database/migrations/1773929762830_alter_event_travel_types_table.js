import { BaseSchema } from '@adonisjs/lucid/schema';
export default class extends BaseSchema {
    tableName = 'event_types';
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
//# sourceMappingURL=1773929762830_alter_event_travel_types_table.js.map