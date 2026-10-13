import { BaseSchema } from '@adonisjs/lucid/schema';
export default class extends BaseSchema {
    tableName = 'files';
    async up() {
        this.schema.alterTable(this.tableName, (table) => {
            table
                .bigInteger('athlete_id')
                .references('id')
                .inTable('base_athlete')
                .onDelete('CASCADE')
                .nullable();
        });
    }
    async down() {
        this.schema.alterTable(this.tableName, (table) => {
            table.dropColumn('athlete_id');
        });
    }
}
//# sourceMappingURL=1754322730581_create_add_athlete_id_to_files_table.js.map