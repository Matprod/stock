import { BaseSchema } from '@adonisjs/lucid/schema';
export default class extends BaseSchema {
    tableName = 'base_injuryhistory';
    async up() {
        this.schema.alterTable(this.tableName, (table) => {
            table.enum('context', ['match', 'training']).nullable();
            table.text('note').nullable();
        });
    }
    async down() {
        this.schema.alterTable(this.tableName, (table) => {
            table.dropColumn('context');
            table.dropColumn('note');
        });
    }
}
//# sourceMappingURL=1761905623693_alter_add_injury_context_and_notes_table.js.map