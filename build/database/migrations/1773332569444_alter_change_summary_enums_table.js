import { BaseSchema } from '@adonisjs/lucid/schema';
export default class extends BaseSchema {
    tableName = 'ai_summaries';
    async up() {
        this.schema.alterTable(this.tableName, (table) => {
            table.enum('entity_type', ['activity', 'nutrition', 'sleep', 'health']).alter();
        });
    }
    async down() {
        this.schema.alterTable(this.tableName, (table) => {
            table.enum('entity_type', ['activity', 'nutrition', 'sleep']).alter();
        });
    }
}
//# sourceMappingURL=1773332569444_alter_change_summary_enums_table.js.map