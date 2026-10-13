import { BaseSchema } from '@adonisjs/lucid/schema';
export default class extends BaseSchema {
    tableName = 'workout_session_exercises';
    async up() {
        this.schema.createTable(this.tableName, (table) => {
            table.uuid('id').primary().notNullable().defaultTo(this.raw('uuidv7()'));
            table
                .uuid('workout_session_id')
                .notNullable()
                .references('id')
                .inTable('workout_sessions')
                .onDelete('CASCADE');
            table
                .uuid('reinforcement_exercise_id')
                .notNullable()
                .references('id')
                .inTable('reinforcement_exercises')
                .onDelete('CASCADE');
            table.timestamps(true, true);
            table.unique(['workout_session_id', 'reinforcement_exercise_id']);
        });
    }
    async down() {
        this.schema.dropTable(this.tableName);
    }
}
//# sourceMappingURL=1780308197070_create_workout_session_exercises_table.js.map