import { BaseSchema } from '@adonisjs/lucid/schema';
export default class extends BaseSchema {
    tableName = 'clubs';
    async up() {
        this.schema.alterTable(this.tableName, (table) => {
            table.dropColumn('sleep_scale_max');
        });
    }
    async down() {
        this.schema.alterTable(this.tableName, (table) => {
            table.integer('sleep_scale_max').notNullable().defaultTo(10);
        });
    }
}
//# sourceMappingURL=1777480668766_alter_remove_sleep_scale_in_clubs_table.js.map