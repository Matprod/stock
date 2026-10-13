import { BaseSchema } from '@adonisjs/lucid/schema';
export default class extends BaseSchema {
    tableName = 'sportactivity_sportactivity';
    async up() {
        this.schema.alterTable(this.tableName, (table) => {
            table.string('activity_name').nullable();
        });
    }
    async down() {
        this.schema.alterTable(this.tableName, (table) => {
            table.dropColumn('activity_name');
        });
    }
}
//# sourceMappingURL=1761658676821_alter_add_activity_names_table.js.map