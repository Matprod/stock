import { BaseSchema } from '@adonisjs/lucid/schema';
export default class extends BaseSchema {
    tableName = 'feature_importances';
    async up() {
        this.schema.alterTable(this.tableName, (table) => {
            table.double('shap_value').nullable().alter();
        });
    }
    async down() {
        this.schema.alterTable(this.tableName, (table) => {
            table.float('shap_value').nullable().alter();
        });
    }
}
//# sourceMappingURL=1768261901997_alter_update_shap_value_type_in_feature_importances_table.js.map