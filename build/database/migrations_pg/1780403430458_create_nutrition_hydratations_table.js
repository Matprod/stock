import { BaseSchema } from '@adonisjs/lucid/schema';
export default class extends BaseSchema {
    tableName = 'hydratations';
    async up() {
        this.schema.createTable(this.tableName, (table) => {
            table.uuid('id').primary().notNullable().defaultTo(this.raw('uuidv7()'));
            table.integer('bottle_count').nullable();
            table.integer('glass_count').nullable();
            table.uuid('day_id').references('id').inTable('days').onDelete('CASCADE').notNullable();
            table.timestamps(true, true);
        });
    }
    async down() {
        this.schema.dropTable(this.tableName);
    }
}
//# sourceMappingURL=1780403430458_create_nutrition_hydratations_table.js.map