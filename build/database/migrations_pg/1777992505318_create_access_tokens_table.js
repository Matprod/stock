import { BaseSchema } from '@adonisjs/lucid/schema';
export default class extends BaseSchema {
    tableName = 'auth_access_tokens';
    async up() {
        this.schema.createTable(this.tableName, (table) => {
            table.uuid('id').primary().notNullable().defaultTo(this.raw('uuidv7()'));
            table
                .uuid('tokenable_id')
                .notNullable()
                .references('id')
                .inTable('users')
                .onDelete('CASCADE')
                .notNullable();
            table.string('type').notNullable();
            table.string('name').nullable();
            table.string('hash').notNullable();
            table.text('abilities').notNullable();
            table.timestamp('last_used_at').nullable();
            table.timestamp('expires_at').nullable();
            table.timestamps(true, true);
        });
    }
    async down() {
        this.schema.dropTableIfExists(this.tableName);
    }
}
//# sourceMappingURL=1777992505318_create_access_tokens_table.js.map