import { BaseSchema } from '@adonisjs/lucid/schema';
export default class extends BaseSchema {
    tableName = 'event_types';
    async up() {
        this.schema.createTable(this.tableName, (table) => {
            table.increments('id');
            table.string('name').notNullable();
            table.string('color').notNullable();
            table.string('icon').notNullable();
            table.enum('event_category', ['training', 'matches', 'medical', 'travel']).notNullable();
            table
                .bigint('activity_id')
                .nullable()
                .references('id')
                .inTable('base_activity')
                .onDelete('SET NULL');
            table.timestamp('created_at');
            table.timestamp('updated_at');
        });
    }
    async down() {
        this.schema.dropTable(this.tableName);
    }
}
//# sourceMappingURL=1765558397964_create_event_types_table.js.map