import { BaseSchema } from '@adonisjs/lucid/schema';
export default class extends BaseSchema {
    tableName = 'base_athleteday';
    async up() {
        this.schema.alterTable(this.tableName, (table) => {
            table.integer('performance_prediction').nullable();
        });
    }
    async down() {
        this.schema.alterTable(this.tableName, (table) => {
            table.dropColumn('performance_prediction');
        });
    }
}
//# sourceMappingURL=1774602580121_alter_performance_predictions_table.js.map