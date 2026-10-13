import { BaseSchema } from '@adonisjs/lucid/schema';
export default class extends BaseSchema {
    tableName = 'exercise_loads';
    async up() {
        this.schema.createTable(this.tableName, (table) => {
            table.increments('id');
            table.bigint('athlete_id').references('id').inTable('base_athlete');
            table.bigint('activity_id').references('id').inTable('base_activity');
            table.float('gear_load_kg').nullable();
            table.float('weapon_load_kg').nullable();
            table.timestamp('created_at');
            table.timestamp('updated_at');
        });
    }
    async down() {
        this.schema.dropTable(this.tableName);
    }
}
//# sourceMappingURL=1763933794819_create_exercise_loads_table.js.map