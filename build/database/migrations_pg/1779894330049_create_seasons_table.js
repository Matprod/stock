import { BaseSchema } from '@adonisjs/lucid/schema';
export default class extends BaseSchema {
    tableName = 'seasons';
    async up() {
        this.schema.createTable(this.tableName, (table) => {
            table.uuid('id').primary().notNullable().defaultTo(this.raw('uuidv7()'));
            table.string('name').notNullable();
            table.date('start_date').notNullable();
            table.date('end_date').notNullable();
            table.uuid('club_id').notNullable().references('id').inTable('clubs').onDelete('CASCADE');
            table.timestamps(true, true);
            table.check('start_date < end_date', [], 'check_dates_order');
        });
    }
    async down() {
        this.schema.dropTable(this.tableName);
    }
}
//# sourceMappingURL=1779894330049_create_seasons_table.js.map