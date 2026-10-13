import { BaseSchema } from '@adonisjs/lucid/schema';
export default class extends BaseSchema {
    tableName = 'event_types';
    async up() {
        this.schema.createTable(this.tableName, (table) => {
            table.uuid('id').primary().notNullable().defaultTo(this.raw('uuidv7()'));
            table.string('name').notNullable();
            table.string('color').notNullable();
            table.string('icon').notNullable();
            table.string('travel_type').nullable();
            table
                .enum('event_category', ['training', 'matches', 'medical', 'travel'], {
                useNative: true,
                enumName: 'event_category_enum',
                existingType: false,
            })
                .notNullable();
            table
                .uuid('activity_id')
                .nullable()
                .references('id')
                .inTable('activities')
                .onDelete('SET NULL');
            table.timestamps(true, true);
        });
    }
    async down() {
        this.schema.dropTable(this.tableName);
        this.schema.raw('DROP TYPE IF EXISTS event_category_enum');
    }
}
//# sourceMappingURL=1780301061652_create_event_types_table.js.map