import { BaseSchema } from '@adonisjs/lucid/schema';
export default class extends BaseSchema {
    tableName = 'base_injuryhistory';
    async up() {
        this.schema.alterTable(this.tableName, (table) => {
            table.enum('context', ['match', 'training', 'other']).nullable().alter();
        });
    }
    async down() {
        this.schema.alterTable(this.tableName, (table) => {
            table.enum('context', ['match', 'training']).nullable().alter();
        });
    }
}
//# sourceMappingURL=1762157957535_alter_add_other_to_injury_contexts_table.js.map