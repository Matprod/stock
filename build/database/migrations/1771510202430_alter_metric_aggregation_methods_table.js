import { BaseSchema } from '@adonisjs/lucid/schema';
export default class extends BaseSchema {
    tableName = 'period_metrics';
    async up() {
        this.schema.alterTable(this.tableName, (table) => {
            table.string('aggregation_method').nullable();
        });
    }
    async down() {
        this.schema.alterTable(this.tableName, (table) => {
            table.dropColumn('aggregation_method');
        });
    }
}
//# sourceMappingURL=1771510202430_alter_metric_aggregation_methods_table.js.map