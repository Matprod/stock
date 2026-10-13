import { BaseSchema } from '@adonisjs/lucid/schema';
export default class extends BaseSchema {
    tableName = 'base_injuryhistory';
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
//# sourceMappingURL=1747128740503_alter_add_recovery_dates_table.js.map