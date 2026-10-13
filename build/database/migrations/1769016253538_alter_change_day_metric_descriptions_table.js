import { BaseSchema } from '@adonisjs/lucid/schema';
export default class extends BaseSchema {
    tableName = 'day_metrics';
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
//# sourceMappingURL=1769016253538_alter_change_day_metric_descriptions_table.js.map