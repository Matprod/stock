import { INSIGHT_CATEGORIES } from '#constants/insight.constants';
import { BaseSchema } from '@adonisjs/lucid/schema';
export default class extends BaseSchema {
    tableName = 'feature_importances';
    async up() {
        this.schema.alterTable(this.tableName, (table) => {
            table.enum('type', ['activity', 'nutrition', 'sleep', 'health']).notNullable();
            table.enum('category', [...INSIGHT_CATEGORIES]).notNullable();
        });
    }
    async down() {
        this.schema.alterTable(this.tableName, (table) => {
            table.dropColumn('type');
            table.dropColumn('category');
        });
    }
}
//# sourceMappingURL=1750026613365_alter_feature_importance_types_table.js.map