import { BaseSchema } from '@adonisjs/lucid/schema';
export default class extends BaseSchema {
    tableName = 'chatbot_messages';
    async up() {
        this.schema.createTable(this.tableName, (table) => {
            table.increments('id');
            table.text('content').notNullable();
            table.enum('type', ['user', 'bot']).notNullable();
            table.integer('chatbot_discussion_id').unsigned().references('id').inTable('chatbot_discussions').onDelete('CASCADE');
            table.timestamp('created_at');
            table.timestamp('updated_at');
        });
    }
    async down() {
        this.schema.dropTable(this.tableName);
    }
}
//# sourceMappingURL=1746546280957_create_chatbot_messages_table.js.map