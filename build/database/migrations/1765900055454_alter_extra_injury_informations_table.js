import { BaseSchema } from '@adonisjs/lucid/schema';
export default class extends BaseSchema {
    tableName = 'base_injuryhistory';
    async up() {
        this.schema.alterTable(this.tableName, (table) => {
            table.string('mechanism').nullable();
            table.string('tissue').nullable();
            table.string('angle').nullable();
            table.string('pathology').nullable();
        });
    }
    async down() {
        this.schema.alterTable(this.tableName, (table) => {
            table.dropColumn('mechanism');
            table.dropColumn('tissue');
            table.dropColumn('angle');
            table.dropColumn('pathology');
        });
    }
}
//# sourceMappingURL=1765900055454_alter_extra_injury_informations_table.js.map