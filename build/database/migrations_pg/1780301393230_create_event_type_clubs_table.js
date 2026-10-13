import { BaseSchema } from '@adonisjs/lucid/schema';
export default class extends BaseSchema {
    tableName = 'event_type_clubs';
    async up() {
        this.schema.createTable(this.tableName, (table) => {
            table.uuid('id').primary().notNullable().defaultTo(this.raw('uuidv7()'));
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
//# sourceMappingURL=1780301393230_create_event_type_clubs_table.js.map