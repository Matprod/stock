import { BaseSchema } from '@adonisjs/lucid/schema';
export default class extends BaseSchema {
    tableName = 'users';
    async up() {
        this.schema.alterTable(this.tableName, (table) => {
            table
                .integer('club_id')
                .unsigned()
                .notNullable()
                .references('id')
                .inTable('clubs')
                .onDelete('CASCADE');
        });
    }
    async down() {
        this.schema.alterTable(this.tableName, (table) => {
            table.dropForeign(['club_id']);
            table.dropColumn('club_id');
        });
    }
}
//# sourceMappingURL=1743291566657_alter_add_user_clubs_table.js.map