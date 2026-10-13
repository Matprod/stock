import { BaseSchema } from '@adonisjs/lucid/schema';
export default class extends BaseSchema {
    tableName = 'base_athletedayavg';
    async up() {
        this.schema.alterTable(this.tableName, (table) => {
            table.integer('carbo_score_today').nullable();
            table.integer('fat_score_today').nullable();
            table.integer('protein_score_today').nullable();
        });
    }
    async down() {
        this.schema.alterTable(this.tableName, (table) => {
            table.dropColumn('carbo_score_today');
            table.dropColumn('fat_score_today');
            table.dropColumn('protein_score_today');
        });
    }
}
//# sourceMappingURL=1758036328299_alter_add_today_scores_table.js.map