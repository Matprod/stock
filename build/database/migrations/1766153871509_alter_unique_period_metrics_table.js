import { BaseSchema } from '@adonisjs/lucid/schema';
export default class extends BaseSchema {
    tableName = 'period_metric_values';
    async up() {
        this.schema.alterTable(this.tableName, (table) => {
            table.unique(['period_id', 'metric_id']);
        });
    }
    async down() {
        this.schema.alterTable(this.tableName, (table) => {
            table.dropUnique(['period_id', 'metric_id']);
        });
    }
}
//# sourceMappingURL=1766153871509_alter_unique_period_metrics_table.js.map