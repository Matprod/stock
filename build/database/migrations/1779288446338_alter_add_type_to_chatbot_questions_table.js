import { INSIGHT_CATEGORIES } from '#constants/insight.constants';
import { BaseSchema } from '@adonisjs/lucid/schema';
export default class extends BaseSchema {
    tableName = 'chatbot_questions';
    async up() {
        this.schema.alterTable(this.tableName, (table) => {
            table.enum('type', ['athlete', 'team', 'user']).notNullable().defaultTo('athlete').after('id');
            table.enum('category', [...INSIGHT_CATEGORIES]).nullable().alter();
        });
    }
    async down() {
        this.schema.alterTable(this.tableName, (table) => {
            table.dropColumn('type');
            table.enum('category', [...INSIGHT_CATEGORIES]).notNullable().alter();
        });
    }
}
//# sourceMappingURL=1779288446338_alter_add_type_to_chatbot_questions_table.js.map