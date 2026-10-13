import { BaseSchema } from '@adonisjs/lucid/schema';
export default class extends BaseSchema {
    tableName = 'injury_types';
    async up() {
        this.schema.createTable(this.tableName, (table) => {
            table.uuid('id').primary().notNullable().defaultTo(this.raw('uuidv7()'));
            table.string('name').nullable();
            table
                .uuid('category_id')
                .references('id')
                .inTable('injury_sections')
                .onDelete('CASCADE')
                .notNullable();
            table.timestamps(true, true);
            table.unique(['category_id', 'name']);
        });
    }
    async down() {
        this.schema.dropTable(this.tableName);
    }
}
//# sourceMappingURL=1780410623586_create_injury_types_table.js.map