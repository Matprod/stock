import { BaseSchema } from '@adonisjs/lucid/schema';
export default class extends BaseSchema {
    tableName = 'player_notes';
    async up() {
        this.schema.alterTable(this.tableName, (table) => {
            table.string('category', 20).nullable().after('content');
            table
                .integer('event_id')
                .unsigned()
                .references('id')
                .inTable('events')
                .onDelete('SET NULL')
                .nullable()
                .after('athlete_id');
        });
    }
    async down() {
        this.schema.alterTable(this.tableName, (table) => {
            table.dropForeign(['event_id']);
            table.dropColumn('event_id');
            table.dropColumn('category');
        });
    }
}
//# sourceMappingURL=1773140266225_alter_player_notes_add_event_fields_table.js.map