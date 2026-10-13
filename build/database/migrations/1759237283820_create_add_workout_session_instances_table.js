import { BaseSchema } from '@adonisjs/lucid/schema';
export default class extends BaseSchema {
    tableName = 'workout_session_instances';
    async up() {
        this.schema.createTable(this.tableName, (table) => {
            table.increments('id');
            table.dateTime('start_time');
            table.integer('duration');
            table.string('title');
            table
                .integer('workout_session_id')
                .unsigned()
                .references('id')
                .inTable('workout_sessions')
                .onDelete('CASCADE');
            table.timestamp('created_at');
            table.timestamp('updated_at');
        });
    }
    async down() {
        this.schema.dropTable(this.tableName);
    }
}
//# sourceMappingURL=1759237283820_create_add_workout_session_instances_table.js.map