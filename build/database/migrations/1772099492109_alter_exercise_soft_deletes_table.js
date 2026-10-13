import { BaseSchema } from '@adonisjs/lucid/schema';
export default class extends BaseSchema {
    tableName = 'sportactivity_reinforcementexercices';
    async up() {
        this.schema.alterTable(this.tableName, (table) => {
            table.timestamp('deleted_at').nullable();
        });
    }
    async down() {
        this.schema.alterTable(this.tableName, (table) => {
            table.dropColumn('deleted_at');
        });
    }
}
//# sourceMappingURL=1772099492109_alter_exercise_soft_deletes_table.js.map