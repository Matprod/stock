import { BaseSchema } from '@adonisjs/lucid/schema';
export default class extends BaseSchema {
    tableName = 'files';
    async up() {
        this.schema.createTable(this.tableName, (table) => {
            table.uuid('id').primary().notNullable().defaultTo(this.raw('uuidv7()'));
            table.enum('type', ['image', 'video', 'document'], {
                useNative: true,
                enumName: 'file_type_enum',
                existingType: false,
            });
            table.string('key').notNullable();
            table.string('file_name').notNullable();
            table.uuid('athlete_id').references('id').inTable('athletes').onDelete('CASCADE').nullable();
            table.timestamps(true, true);
        });
    }
    async down() {
        this.schema.dropTable(this.tableName);
        this.schema.raw('DROP TYPE IF EXISTS file_type_enum');
    }
}
//# sourceMappingURL=1780562407269_create_files_table.js.map