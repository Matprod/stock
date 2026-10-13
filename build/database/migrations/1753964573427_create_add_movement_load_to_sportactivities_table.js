import { BaseSchema } from '@adonisjs/lucid/schema';
export default class extends BaseSchema {
    tableName = 'sportactivity_sportactivity';
    async up() {
        this.schema.alterTable(this.tableName, (table) => {
            table.float('movement_load').nullable();
        });
    }
    async down() {
        this.schema.alterTable(this.tableName, (table) => {
            table.dropColumn('movement_load');
        });
    }
}
//# sourceMappingURL=1753964573427_create_add_movement_load_to_sportactivities_table.js.map