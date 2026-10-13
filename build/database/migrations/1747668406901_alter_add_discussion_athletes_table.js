import { BaseSchema } from '@adonisjs/lucid/schema';
export default class extends BaseSchema {
    tableName = 'chatbot_discussions';
    async up() {
        this.schema.alterTable(this.tableName, (table) => {
            table.bigint('athlete_id').references('id').inTable('base_athlete');
        });
    }
    async down() {
        this.schema.alterTable(this.tableName, (table) => {
            table.dropForeign(['athlete_id']);
            table.dropColumn('athlete_id');
        });
    }
}
//# sourceMappingURL=1747668406901_alter_add_discussion_athletes_table.js.map