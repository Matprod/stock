import { INSIGHT_CATEGORIES } from '#constants/insight.constants';
import { BaseSchema } from '@adonisjs/lucid/schema';
export default class extends BaseSchema {
    tableName = 'chatbot_discussions';
    async up() {
        this.schema.alterTable(this.tableName, (table) => {
            table.enum('category', [...INSIGHT_CATEGORIES]).nullable();
        });
    }
    async down() {
        this.schema.alterTable(this.tableName, (table) => {
            table.dropColumn('category');
        });
    }
}
//# sourceMappingURL=1780591279968_alter_add_category_to_chatbot_discussions_table.js.map