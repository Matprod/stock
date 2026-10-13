import { BaseSchema } from '@adonisjs/lucid/schema';
export default class extends BaseSchema {
    tableName = 'vald_tests';
    async up() {
        this.schema.alterTable(this.tableName, (table) => {
            table.string('provider_test_id').nullable().unique();
        });
    }
    async down() {
        this.schema.alterTable(this.tableName, (table) => {
            table.dropUnique(['provider_test_id']);
            table.dropColumn('provider_test_id');
        });
    }
}
//# sourceMappingURL=1789381665265_alter_vald_tests_add_provider_test_id.js.map