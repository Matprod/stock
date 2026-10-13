import { BaseSchema } from '@adonisjs/lucid/schema';
export default class extends BaseSchema {
    tableName = 'base_athletedayavg';
    async up() {
        this.schema.alterTable(this.tableName, (table) => {
            table.double('travel_fatigue').nullable();
        });
    }
    async down() {
        this.schema.alterTable(this.tableName, (table) => {
            table.dropColumn('travel_fatigue');
        });
    }
}
//# sourceMappingURL=1755532962092_alter_add_travel_fatigues_table.js.map