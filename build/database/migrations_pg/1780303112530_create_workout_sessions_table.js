import { BaseSchema } from '@adonisjs/lucid/schema';
export default class extends BaseSchema {
    tableName = 'workout_sessions';
    async up() {
        this.schema.createTable(this.tableName, (table) => {
            table.uuid('id').primary().notNullable().defaultTo(this.raw('uuidv7()'));
            table.string('name').notNullable();
            table.integer('duration_seconds').nullable();
            table.uuid('club_id').notNullable().references('id').inTable('clubs').onDelete('CASCADE');
            table.timestamps(true, true);
        });
    }
    async down() {
        this.schema.dropTable(this.tableName);
    }
}
//# sourceMappingURL=1780303112530_create_workout_sessions_table.js.map