import { BaseSchema } from '@adonisjs/lucid/schema';
export default class extends BaseSchema {
    tableName = 'demo_pairs';
    async up() {
        this.schema.alterTable(this.tableName, (table) => {
            table.json('embedding').nullable();
        });
    }
    async down() {
        this.schema.alterTable(this.tableName, (table) => {
            table.dropColumn('embedding');
        });
    }
}
//# sourceMappingURL=1746921600000_alter_demo_pairs_add_embedding.js.map