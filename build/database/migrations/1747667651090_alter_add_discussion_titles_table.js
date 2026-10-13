import { BaseSchema } from '@adonisjs/lucid/schema';
export default class extends BaseSchema {
    tableName = 'chatbot_discussions';
    async up() {
        this.schema.alterTable(this.tableName, (table) => {
            table.string('title').defaultTo('');
        });
    }
    async down() {
        this.schema.alterTable(this.tableName, (table) => {
            table.dropColumn('title');
        });
    }
}
//# sourceMappingURL=1747667651090_alter_add_discussion_titles_table.js.map