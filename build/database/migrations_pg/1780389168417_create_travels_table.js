import { BaseSchema } from '@adonisjs/lucid/schema';
export default class extends BaseSchema {
    tableName = 'travels';
    async up() {
        this.schema.createTable(this.tableName, (table) => {
            table.uuid('id').primary().notNullable().defaultTo(this.raw('uuidv7()'));
            table.string('mean_of_transport').notNullable();
            table.integer('duration_minutes').notNullable();
            table
                .uuid('health_id')
                .notNullable()
                .references('id')
                .inTable('health_ratings')
                .onDelete('CASCADE');
            table.uuid('event_id').nullable().references('id').inTable('events').onDelete('CASCADE');
            table.timestamps(true, true);
        });
    }
    async down() {
        this.schema.dropTable(this.tableName);
    }
}
//# sourceMappingURL=1780389168417_create_travels_table.js.map