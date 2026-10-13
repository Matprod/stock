import { BaseSchema } from '@adonisjs/lucid/schema';
export default class extends BaseSchema {
    tableName = 'days';
    async up() {
        this.schema.alterTable(this.tableName, (table) => {
            table.integer('performance_score_test').nullable();
        });
    }
    async down() {
        this.schema.alterTable(this.tableName, (table) => {
            table.dropColumn('performance_score_test');
        });
    }
}
//# sourceMappingURL=1788252000000_alter_days_add_performance_score_test.js.map