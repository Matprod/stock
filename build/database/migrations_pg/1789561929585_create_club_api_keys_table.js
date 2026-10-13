import { BaseSchema } from '@adonisjs/lucid/schema';
export default class extends BaseSchema {
    tableName = 'club_api_keys';
    async up() {
        this.schema.createTable(this.tableName, (table) => {
            table.uuid('id').primary().notNullable().defaultTo(this.raw('uuidv7()'));
            table.uuid('club_id').notNullable().references('id').inTable('clubs').onDelete('CASCADE');
            table.string('name').notNullable();
            table.string('key_prefix').notNullable();
            table.string('key_hash', 64).notNullable().unique();
            table.timestamp('last_used_at').nullable();
            table.timestamp('revoked_at').nullable();
            table.timestamp('created_at');
            table.timestamp('updated_at');
            table.index(['club_id']);
        });
    }
    async down() {
        this.schema.dropTable(this.tableName);
    }
}
//# sourceMappingURL=1789561929585_create_club_api_keys_table.js.map