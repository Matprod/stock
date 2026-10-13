import { BaseSchema } from '@adonisjs/lucid/schema';
export default class extends BaseSchema {
    tableName = 'biomarkers';
    async up() {
        this.schema.createTable(this.tableName, (table) => {
            table.uuid('id').primary().notNullable().defaultTo(this.raw('uuidv7()'));
            table.string('value').notNullable();
            table.timestamp('measured_at', { useTz: true }).notNullable();
            table
                .uuid('athlete_id')
                .references('id')
                .inTable('athletes')
                .onDelete('CASCADE')
                .notNullable();
            table
                .uuid('biomarker_type_id')
                .references('id')
                .inTable('biomarker_types')
                .onDelete('CASCADE')
                .notNullable();
            table.timestamps(true, true);
        });
    }
    async down() {
        this.schema.dropTable(this.tableName);
    }
}
//# sourceMappingURL=1784541628569_create_biomarkers_table.js.map