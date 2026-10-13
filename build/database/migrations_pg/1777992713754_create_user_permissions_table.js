import { BaseSchema } from '@adonisjs/lucid/schema';
export default class extends BaseSchema {
    tableName = 'user_permissions';
    async up() {
        this.schema.createTable(this.tableName, (table) => {
            table.uuid('id').primary().notNullable().defaultTo(this.raw('uuidv7()'));
            table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
            table
                .uuid('permission_id')
                .notNullable()
                .references('id')
                .inTable('permissions')
                .onDelete('CASCADE');
            table.timestamps(true, true);
            table.unique(['user_id', 'permission_id']);
        });
    }
    async down() {
        this.schema.dropTableIfExists(this.tableName);
    }
}
//# sourceMappingURL=1777992713754_create_user_permissions_table.js.map