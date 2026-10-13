import { BaseSchema } from '@adonisjs/lucid/schema';
export default class extends BaseSchema {
    tableName = 'translations';
    async up() {
        this.schema.alterTable(this.tableName, (table) => {
            table
                .enum('translatable_type', ['insight', 'player_position', 'notification_message'])
                .notNullable()
                .alter();
            table
                .enum('key', [
                'insight_name',
                'insight_description',
                'player_position_name',
                'notification_message_title',
                'notification_message_content',
            ])
                .notNullable()
                .alter();
        });
    }
    async down() {
        this.schema.alterTable(this.tableName, (table) => {
            table.enum('translatable_type', ['insight', 'player_position']).notNullable().alter();
            table
                .enum('key', ['insight_name', 'insight_description', 'player_position_name'])
                .notNullable()
                .alter();
        });
    }
}
//# sourceMappingURL=1758277765774_alter_notification_message_translations.js.map