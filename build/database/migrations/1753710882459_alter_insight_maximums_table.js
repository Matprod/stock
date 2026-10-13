import { BaseSchema } from '@adonisjs/lucid/schema';
export default class extends BaseSchema {
    tableName = 'insights';
    async up() {
        this.schema.alterTable(this.tableName, (table) => {
            table.float('maximum').nullable();
        });
    }
    async down() {
        this.schema.alterTable(this.tableName, (table) => {
            table.dropColumn('maximum');
        });
    }
}
//# sourceMappingURL=1753710882459_alter_insight_maximums_table.js.map