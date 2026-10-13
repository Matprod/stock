import { BaseSchema } from '@adonisjs/lucid/schema';
export default class extends BaseSchema {
    tableName = 'sport_activity_intakes';
    async up() {
        this.schema.createTable(this.tableName, (table) => {
            table.uuid('id').primary().notNullable().defaultTo(this.raw('uuidv7()'));
            table.decimal('quantity', 10, 2).notNullable();
            table.decimal('portion', 10, 2).nullable();
            table
                .uuid('aliment_id')
                .references('id')
                .inTable('aliments')
                .onDelete('CASCADE')
                .notNullable();
            table
                .uuid('sport_activity_id')
                .references('id')
                .inTable('sport_activities')
                .onDelete('CASCADE')
                .notNullable();
            table.timestamps(true, true);
            table.index(['sport_activity_id', 'aliment_id']);
        });
    }
    async down() {
        this.schema.dropTable(this.tableName);
    }
}
//# sourceMappingURL=1781271797333_create_activity_food_intakes_table.js.map