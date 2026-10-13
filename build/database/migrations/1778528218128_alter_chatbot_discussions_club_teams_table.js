import { BaseSchema } from '@adonisjs/lucid/schema';
export default class extends BaseSchema {
    tableName = 'chatbot_discussions';
    async up() {
        this.schema.alterTable(this.tableName, (table) => {
            table.dropForeign(['athlete_id']);
        });
        this.schema.alterTable(this.tableName, (table) => {
            table.bigInteger('athlete_id').nullable().alter();
        });
        this.schema.alterTable(this.tableName, (table) => {
            table.foreign('athlete_id').references('id').inTable('base_athlete');
        });
    }
    async down() { }
}
//# sourceMappingURL=1778528218128_alter_chatbot_discussions_club_teams_table.js.map