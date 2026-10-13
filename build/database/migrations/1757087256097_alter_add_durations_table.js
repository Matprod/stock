import { BaseSchema } from '@adonisjs/lucid/schema';
export default class extends BaseSchema {
    tableName = 'workout_sessions';
    async up() {
        this.schema.alterTable(this.tableName, (table) => {
            table.integer('duration').nullable();
        });
    }
    async down() {
        this.schema.alterTable(this.tableName, (table) => {
            table.dropColumn('duration');
        });
    }
}
//# sourceMappingURL=1757087256097_alter_add_durations_table.js.map