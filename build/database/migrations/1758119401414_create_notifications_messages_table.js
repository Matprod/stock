import { BaseSchema } from '@adonisjs/lucid/schema';
export default class extends BaseSchema {
    tableName = 'notifications_messages';
    async up() {
        this.schema.createTable(this.tableName, (table) => {
            table.increments('id');
            table.string('message').notNullable();
            table.timestamp('created_at');
            table.timestamp('updated_at');
        });
    }
    async down() {
        this.schema.dropTable(this.tableName);
    }
}
//# sourceMappingURL=1758119401414_create_notifications_messages_table.js.map