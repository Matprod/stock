import { BaseSchema } from '@adonisjs/lucid/schema';
export default class extends BaseSchema {
    tableName = 'injuries';
    async up() {
        this.schema.createTable(this.tableName, (table) => {
            table.uuid('id').primary().notNullable().defaultTo(this.raw('uuidv7()'));
            table.date('date_of_injury').notNullable();
            table.date('recovery_date').nullable();
            table
                .enum('context', ['match', 'training', 'other'], {
                useNative: true,
                enumName: 'injury_context_enum',
                existingType: false,
            })
                .nullable();
            table.text('note').nullable();
            table.string('mechanism').nullable();
            table.string('tissue').nullable();
            table.string('angle').nullable();
            table.string('pathology').nullable();
            table.string('source').notNullable().defaultTo('manual');
            table
                .uuid('athlete_id')
                .references('id')
                .inTable('athletes')
                .onDelete('CASCADE')
                .notNullable();
            table
                .uuid('type_of_injury_id')
                .references('id')
                .inTable('injury_types')
                .onDelete('CASCADE')
                .notNullable();
            table.timestamps(true, true);
        });
    }
    async down() {
        this.schema.dropTable(this.tableName);
        this.schema.raw('DROP TYPE IF EXISTS injury_context_enum');
    }
}
//# sourceMappingURL=1780415245981_create_injuries_table.js.map