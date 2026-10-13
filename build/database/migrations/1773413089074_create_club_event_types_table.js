import { BaseSchema } from '@adonisjs/lucid/schema';
export default class extends BaseSchema {
    tableName = 'event_type_clubs';
    async up() {
        this.schema.createTable(this.tableName, (table) => {
            table.increments('id');
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
//# sourceMappingURL=1773413089074_create_club_event_types_table.js.map