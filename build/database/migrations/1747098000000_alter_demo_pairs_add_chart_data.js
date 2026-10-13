import { BaseSchema } from '@adonisjs/lucid/schema';
export default class extends BaseSchema {
    tableName = 'demo_pairs';
    async up() {
        this.schema.alterTable(this.tableName, (table) => {
            table.json('chart_data').nullable();
        });
    }
    async down() {
        this.schema.alterTable(this.tableName, (table) => {
            table.dropColumn('chart_data');
        });
    }
}
//# sourceMappingURL=1747098000000_alter_demo_pairs_add_chart_data.js.map