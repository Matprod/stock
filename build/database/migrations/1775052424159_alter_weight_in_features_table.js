import { BaseSchema } from '@adonisjs/lucid/schema';
export default class extends BaseSchema {
    tableName = 'feature_importances';
    async up() {
        this.schema.alterTable(this.tableName, (table) => {
            table.float('contrib_pct').nullable();
        });
    }
    async down() {
        this.schema.alterTable(this.tableName, (table) => {
            table.dropColumn('contrib_pct');
        });
    }
}
//# sourceMappingURL=1775052424159_alter_weight_in_features_table.js.map