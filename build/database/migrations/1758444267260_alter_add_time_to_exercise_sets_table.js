import { BaseSchema } from '@adonisjs/lucid/schema';
export default class extends BaseSchema {
    tableName = 'sportactivity_exerciseset';
    async up() {
        this.schema.alterTable(this.tableName, (table) => {
            table.time('time').nullable();
        });
    }
    async down() {
        this.schema.alterTable(this.tableName, (table) => {
            table.dropColumn('time');
        });
    }
}
//# sourceMappingURL=1758444267260_alter_add_time_to_exercise_sets_table.js.map