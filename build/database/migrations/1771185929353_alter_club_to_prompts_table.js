import { BaseSchema } from '@adonisjs/lucid/schema';
export default class extends BaseSchema {
    tableName = 'prompts';
    async up() {
        this.schema.alterTable(this.tableName, (table) => {
            table.integer('club_id').unsigned().references('id').inTable('clubs').onDelete('CASCADE');
        });
    }
    async down() {
        this.schema.alterTable(this.tableName, (table) => {
            table.dropForeign(['club_id']);
            table.dropColumn('club_id');
        });
    }
}
//# sourceMappingURL=1771185929353_alter_club_to_prompts_table.js.map