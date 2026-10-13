import { BaseSchema } from '@adonisjs/lucid/schema';
export default class extends BaseSchema {
    tableName = 'player_notes';
    async up() {
        this.schema.createTable(this.tableName, (table) => {
            table.increments('id');
            table.bigInteger('athlete_id').references('id').inTable('base_athlete').onDelete('CASCADE');
            table.date('note_date').notNullable();
            table.text('content').notNullable();
            table.timestamp('created_at');
            table.timestamp('updated_at');
        });
    }
    async down() {
        this.schema.dropTable(this.tableName);
    }
}
//# sourceMappingURL=1748000000000_create_player_notes_table.js.map