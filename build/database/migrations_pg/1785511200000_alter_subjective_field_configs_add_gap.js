import { BaseSchema } from '@adonisjs/lucid/schema';
export default class extends BaseSchema {
    tableName = 'subjective_field_configs';
    async up() {
        this.schema.alterTable(this.tableName, (table) => {
            table.integer('gap').nullable();
        });
    }
    async down() {
        this.schema.alterTable(this.tableName, (table) => {
            table.dropColumn('gap');
        });
    }
}
//# sourceMappingURL=1785511200000_alter_subjective_field_configs_add_gap.js.map