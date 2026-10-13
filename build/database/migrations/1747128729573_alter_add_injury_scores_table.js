import { BaseSchema } from '@adonisjs/lucid/schema';
export default class extends BaseSchema {
    tableName = 'base_athleteday';
    async up() {
        this.schema.alterTable(this.tableName, (table) => {
            table.integer('sleep_score').nullable();
            table.integer('injury_score').nullable();
            table.integer('injury_health_score').nullable();
            table.integer('injury_activity_score').nullable();
            table.integer('injury_sleep_score').nullable();
        });
    }
    async down() {
        this.schema.alterTable(this.tableName, (table) => {
            table.dropColumn('sleep_score');
            table.dropColumn('injury_score');
            table.dropColumn('injury_health_score');
            table.dropColumn('injury_activity_score');
            table.dropColumn('injury_sleep_score');
        });
    }
}
//# sourceMappingURL=1747128729573_alter_add_injury_scores_table.js.map