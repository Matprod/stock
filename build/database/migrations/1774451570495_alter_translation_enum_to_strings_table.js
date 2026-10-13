import { BaseSchema } from '@adonisjs/lucid/schema';
export default class extends BaseSchema {
    tableName = 'translations';
    async up() {
        this.schema.alterTable(this.tableName, (table) => {
            table.string('translatable_type').notNullable().alter();
            table.string('key').notNullable().alter();
        });
    }
    async down() {
        this.schema.alterTable(this.tableName, (table) => {
            table
                .enum('translatable_type', [
                'insight',
                'player_position',
                'notification_message',
                'chatbot_question',
            ])
                .notNullable()
                .alter();
            table
                .enum('key', [
                'insight_name',
                'insight_description',
                'player_position_name',
                'notification_message_title',
                'notification_message_content',
                'chatbot_question_title',
                'chatbot_question_text',
            ])
                .notNullable()
                .alter();
        });
    }
}
//# sourceMappingURL=1774451570495_alter_translation_enum_to_strings_table.js.map