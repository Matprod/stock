import { BaseSchema } from '@adonisjs/lucid/schema';
export default class extends BaseSchema {
    tableName = 'biomarker_types';
    async up() {
        this.schema.alterTable(this.tableName, (table) => {
            table.string('display_name').nullable();
        });
    }
    async down() {
        this.schema.alterTable(this.tableName, (table) => {
            table.dropColumn('display_name');
        });
    }
}
//# sourceMappingURL=1788600000200_alter_biomarker_types_add_display_name.js.map