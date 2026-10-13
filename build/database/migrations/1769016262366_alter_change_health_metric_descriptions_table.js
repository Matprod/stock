import { BaseSchema } from '@adonisjs/lucid/schema';
export default class extends BaseSchema {
    tableName = 'health_metrics';
    async up() {
        this.schema.alterTable(this.tableName, (table) => {
            table.text('description').nullable().alter();
        });
    }
    async down() {
        this.schema.alterTable(this.tableName, (table) => {
            table.string('description').nullable().alter();
        });
    }
}
//# sourceMappingURL=1769016262366_alter_change_health_metric_descriptions_table.js.map