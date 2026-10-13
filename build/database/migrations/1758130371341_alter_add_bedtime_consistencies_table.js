import { BaseSchema } from '@adonisjs/lucid/schema';
export default class extends BaseSchema {
    tableName = 'base_athletedayavg';
    async up() {
        this.schema.alterTable(this.tableName, (table) => {
            table.integer('bedtime_consistency_score');
        });
    }
    async down() {
        this.schema.alterTable(this.tableName, (table) => {
            table.dropColumn('bedtime_consistency_score');
        });
    }
}
//# sourceMappingURL=1758130371341_alter_add_bedtime_consistencies_table.js.map