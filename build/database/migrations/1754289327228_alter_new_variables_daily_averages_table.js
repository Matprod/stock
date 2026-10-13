import { BaseSchema } from '@adonisjs/lucid/schema';
export default class extends BaseSchema {
    tableName = 'base_athletedayavg';
    async up() {
        this.schema.alterTable(this.tableName, (table) => {
            table.double('avgCarbohydrate').nullable();
        });
    }
    async down() {
        this.schema.alterTable(this.tableName, (table) => {
            table.dropColumn('avgCarbohydrate');
        });
    }
}
//# sourceMappingURL=1754289327228_alter_new_variables_daily_averages_table.js.map