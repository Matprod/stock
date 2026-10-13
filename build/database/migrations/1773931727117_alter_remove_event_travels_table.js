import { BaseSchema } from '@adonisjs/lucid/schema';
export default class extends BaseSchema {
    tableName = 'events';
    async up() {
        this.schema.alterTable(this.tableName, (table) => {
            table.dropColumn('travel_type');
        });
    }
    async down() {
        this.schema.alterTable(this.tableName, (table) => {
            table.string('travel_type', 20).nullable();
        });
    }
}
//# sourceMappingURL=1773931727117_alter_remove_event_travels_table.js.map