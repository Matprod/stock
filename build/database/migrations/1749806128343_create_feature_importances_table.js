import { BaseSchema } from '@adonisjs/lucid/schema';
export default class extends BaseSchema {
    tableName = 'feature_importances';
    async up() {
        this.schema.createTable(this.tableName, (table) => {
            table.increments('id');
            table.float('value').notNullable();
            table.float('optimal').notNullable();
            table.float('shap_value').notNullable();
            table.integer('insight_id').unsigned().references('id').inTable('insights').onDelete('CASCADE');
            table.timestamp('created_at');
            table.timestamp('updated_at');
        });
    }
    async down() {
        this.schema.dropTable(this.tableName);
    }
}
//# sourceMappingURL=1749806128343_create_feature_importances_table.js.map