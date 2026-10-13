import { BaseSchema } from '@adonisjs/lucid/schema';
export default class extends BaseSchema {
    tableName = 'clubs';
    async up() {
        this.schema.alterTable(this.tableName, (table) => {
            table.date('start_date').nullable();
            table.date('end_date').nullable();
        });
    }
    async down() {
        this.schema.alterTable(this.tableName, (table) => {
            table.dropColumn('start_date');
            table.dropColumn('end_date');
        });
    }
}
//# sourceMappingURL=1759155210726_alter_add_start_and_end_date_to_clubs_table.js.map