import { BaseSchema } from '@adonisjs/lucid/schema';
export default class extends BaseSchema {
    tableName = 'sportactivity_sportactivity';
    async up() {
        this.schema.alterTable(this.tableName, (table) => {
            table.integer('fc_max').nullable().unsigned();
        });
    }
    async down() {
        this.schema.alterTable(this.tableName, (table) => {
            table.dropColumn('fc_max');
        });
    }
}
//# sourceMappingURL=1755014044365_alter_add_max_hrs_table.js.map