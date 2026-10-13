import { BaseSchema } from '@adonisjs/lucid/schema';
export default class extends BaseSchema {
    tableName = 'nutrition_chatgptnutrition';
    async up() {
        this.schema.alterTable(this.tableName, (table) => {
            table.string('name_fr', 300).nullable();
        });
    }
    async down() {
        this.schema.alterTable(this.tableName, (table) => {
            table.dropColumn('name_fr');
        });
    }
}
//# sourceMappingURL=1752845739_alter_add_name_fr_to_chatgptnutrition_table.js.map