import { BaseSchema } from '@adonisjs/lucid/schema';
export default class extends BaseSchema {
    tableName = 'recipes';
    async up() {
        this.schema.createTable(this.tableName, (table) => {
            table.uuid('id').primary().notNullable().defaultTo(this.raw('uuidv7()'));
            table.string('name').notNullable();
            table
                .uuid('athlete_id')
                .references('id')
                .inTable('athletes')
                .onDelete('CASCADE')
                .notNullable();
            table.timestamps(true, true);
            table.unique(['athlete_id', 'name']);
        });
    }
    async down() {
        this.schema.dropTable(this.tableName);
    }
}
//# sourceMappingURL=1780404038292_create_recipes_table.js.map