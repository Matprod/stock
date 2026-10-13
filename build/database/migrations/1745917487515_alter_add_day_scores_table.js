import { BaseSchema } from '@adonisjs/lucid/schema';
export default class extends BaseSchema {
    tableName = 'base_athleteday';
    async up() {
        this.schema.alterTable(this.tableName, (table) => {
            table.integer('performance_score').nullable();
            table.integer('health_score').nullable();
            table.integer('activity_score').nullable();
        });
    }
    async down() {
        this.schema.alterTable(this.tableName, (table) => {
            table.dropColumn('performance_score');
            table.dropColumn('health_score');
            table.dropColumn('activity_score');
        });
    }
}
//# sourceMappingURL=1745917487515_alter_add_day_scores_table.js.map