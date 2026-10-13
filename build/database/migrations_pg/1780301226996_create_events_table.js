import { BaseSchema } from '@adonisjs/lucid/schema';
export default class extends BaseSchema {
    tableName = 'events';
    async up() {
        this.schema.createTable(this.tableName, (table) => {
            table.uuid('id').primary().notNullable().defaultTo(this.raw('uuidv7()'));
            table.dateTime('start_time', { useTz: true }).notNullable();
            table.dateTime('end_time', { useTz: true }).notNullable();
            table.string('title').notNullable();
            table.string('location').nullable();
            table
                .uuid('event_type_id')
                .notNullable()
                .references('id')
                .inTable('event_types')
                .onDelete('CASCADE');
            table.uuid('club_id').notNullable().references('id').inTable('clubs').onDelete('CASCADE');
            table.timestamps(true, true);
        });
    }
    async down() {
        this.schema.dropTable(this.tableName);
    }
}
//# sourceMappingURL=1780301226996_create_events_table.js.map