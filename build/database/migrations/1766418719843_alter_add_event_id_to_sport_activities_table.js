import { BaseSchema } from '@adonisjs/lucid/schema';
export default class extends BaseSchema {
    tableName = 'sportactivity_sportactivity';
    async up() {
        this.schema.alterTable(this.tableName, (table) => {
            table
                .integer('event_id')
                .unsigned()
                .nullable()
                .references('id')
                .inTable('events')
                .onDelete('SET NULL');
        });
    }
    async down() {
        this.schema.alterTable(this.tableName, (table) => {
            table.dropForeign(['event_id']);
            table.dropColumn('event_id');
        });
    }
}
//# sourceMappingURL=1766418719843_alter_add_event_id_to_sport_activities_table.js.map