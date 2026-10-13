import { BaseSchema } from '@adonisjs/lucid/schema';
export default class extends BaseSchema {
    tableName = 'reports';
    async up() {
        this.schema.createTable(this.tableName, (table) => {
            table.uuid('id').primary().notNullable().defaultTo(this.raw('uuidv7()'));
            table.uuid('club_id').notNullable().references('id').inTable('clubs').onDelete('CASCADE');
            table.uuid('created_by').nullable().references('id').inTable('users').onDelete('SET NULL');
            table.string('title').notNullable().defaultTo('Untitled');
            table.date('date_from').notNullable();
            table.date('date_to').notNullable();
            table.jsonb('blocs').notNullable();
            table.timestamps(true, true);
            table.index('club_id');
        });
    }
    async down() {
        this.schema.dropTable(this.tableName);
    }
}
//# sourceMappingURL=1788552579857_create_reports_table.js.map