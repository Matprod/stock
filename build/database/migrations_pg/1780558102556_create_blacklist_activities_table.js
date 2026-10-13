import { BaseSchema } from '@adonisjs/lucid/schema';
export default class extends BaseSchema {
    tableName = 'blacklist_activities';
    async up() {
        this.schema.createTable(this.tableName, (table) => {
            table.uuid('id').primary().notNullable().defaultTo(this.raw('uuidv7()'));
            table.uuid('club_id').references('id').inTable('clubs').onDelete('CASCADE').notNullable();
            table
                .uuid('activity_id')
                .references('id')
                .inTable('activities')
                .onDelete('CASCADE')
                .notNullable();
            table.timestamps(true, true);
            table.unique(['club_id', 'activity_id']);
            table.index('activity_id');
        });
    }
    async down() {
        this.schema.dropTable(this.tableName);
    }
}
//# sourceMappingURL=1780558102556_create_blacklist_activities_table.js.map