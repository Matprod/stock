import { BaseSchema } from '@adonisjs/lucid/schema';
export default class extends BaseSchema {
    tableName = 'recipe_aliments';
    async up() {
        this.schema.createTable(this.tableName, (table) => {
            table.uuid('id').primary().notNullable().defaultTo(this.raw('uuidv7()'));
            table.double('quantity').notNullable();
            table.double('portion').notNullable().defaultTo(1);
            table.uuid('recipe_id').references('id').inTable('recipes').onDelete('CASCADE').notNullable();
            table
                .uuid('aliment_id')
                .references('id')
                .inTable('aliments')
                .onDelete('CASCADE')
                .notNullable();
            table.timestamps(true, true);
        });
    }
    async down() {
        this.schema.dropTable(this.tableName);
    }
}
//# sourceMappingURL=1780404248874_create_recipe_aliments_table.js.map