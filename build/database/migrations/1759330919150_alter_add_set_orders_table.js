import { BaseSchema } from '@adonisjs/lucid/schema';
export default class extends BaseSchema {
    tableName = 'sportactivity_exerciseset';
    async up() {
        this.schema.alterTable(this.tableName, (table) => {
            table.integer('set_order').nullable();
        });
    }
    async down() {
        this.schema.alterTable(this.tableName, (table) => {
            table.dropColumn('set_order');
        });
    }
}
//# sourceMappingURL=1759330919150_alter_add_set_orders_table.js.map