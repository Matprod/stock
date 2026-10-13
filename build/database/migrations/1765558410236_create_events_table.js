import { BaseSchema } from '@adonisjs/lucid/schema';
export default class extends BaseSchema {
    tableName = 'events';
    async up() {
        this.schema.createTable(this.tableName, (table) => {
            table.increments('id');
            table.dateTime('start_time', { useTz: true }).notNullable();
            table.dateTime('end_time', { useTz: true }).notNullable();
            table.string('title').notNullable();
            table.string('location').nullable();
            table
                .integer('event_type_id')
                .unsigned()
                .notNullable()
                .references('id')
                .inTable('event_types')
                .onDelete('CASCADE');
            table
                .integer('club_id')
                .unsigned()
                .notNullable()
                .references('id')
                .inTable('clubs')
                .onDelete('CASCADE');
            table.timestamp('created_at');
            table.timestamp('updated_at');
        });
    }
    async down() {
        this.schema.dropTable(this.tableName);
    }
}
//# sourceMappingURL=1765558410236_create_events_table.js.map