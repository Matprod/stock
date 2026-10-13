import { BaseSchema } from '@adonisjs/lucid/schema';
export default class extends BaseSchema {
    tableName = 'insights';
    async up() {
        this.schema.createTable(this.tableName, (table) => {
            table.increments('id');
            table.string('variable_name').notNullable();
            table.string('name').notNullable();
            table.string('description').notNullable();
            table.boolean('can_too_high').notNullable();
            table.boolean('can_too_low').notNullable();
            table.timestamp('created_at');
            table.timestamp('updated_at');
        });
    }
    async down() {
        this.schema.dropTable(this.tableName);
    }
}
//# sourceMappingURL=1747320722840_create_insights_table.js.map