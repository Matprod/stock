import { BaseSchema } from '@adonisjs/lucid/schema';
export default class extends BaseSchema {
    tableName = 'notifications_messages';
    async up() {
        this.schema.alterTable(this.tableName, (table) => {
            table.dropColumn('message');
            table.string('title').notNullable();
            table.text('content').notNullable();
        });
    }
    async down() {
        this.schema.alterTable(this.tableName, (table) => {
            table.dropColumn('title');
            table.dropColumn('content');
            table.string('message').notNullable();
        });
    }
}
//# sourceMappingURL=1758209637592_alter_add_title_and_contents_table.js.map