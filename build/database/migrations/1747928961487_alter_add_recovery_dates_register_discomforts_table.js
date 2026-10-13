import { BaseSchema } from '@adonisjs/lucid/schema';
export default class extends BaseSchema {
    tableName = 'base_registerdiscomfort';
    async up() {
        this.schema.alterTable(this.tableName, (table) => {
            table.date('recovery_date').nullable();
        });
    }
    async down() {
        this.schema.alterTable(this.tableName, (table) => {
            table.dropColumn('recovery_date');
        });
    }
}
//# sourceMappingURL=1747928961487_alter_add_recovery_dates_register_discomforts_table.js.map