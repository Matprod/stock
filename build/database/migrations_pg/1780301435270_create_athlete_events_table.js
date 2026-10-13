import { BaseSchema } from '@adonisjs/lucid/schema';
export default class extends BaseSchema {
    tableName = 'athlete_events';
    async up() {
        this.schema.createTable(this.tableName, (table) => {
            table.uuid('id').primary().notNullable().defaultTo(this.raw('uuidv7()'));
            table
                .uuid('athlete_id')
                .notNullable()
                .references('id')
                .inTable('athletes')
                .onDelete('CASCADE');
            table.uuid('event_id').notNullable().references('id').inTable('events').onDelete('CASCADE');
            table.timestamps(true, true);
        });
    }
    async down() {
        this.schema.dropTable(this.tableName);
    }
}
//# sourceMappingURL=1780301435270_create_athlete_events_table.js.map