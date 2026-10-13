import { BaseSchema } from '@adonisjs/lucid/schema';
export default class extends BaseSchema {
    tableName = 'activity_display_variables';
    async up() {
        this.schema.createTable(this.tableName, (table) => {
            table.increments('id');
            table.bigint('activity_id').nullable().references('id').inTable('base_activity');
            table
                .integer('display_variable_id')
                .unsigned()
                .notNullable()
                .references('id')
                .inTable('display_variables')
                .onDelete('CASCADE');
            table.string('unit').nullable();
            table.timestamp('created_at');
            table.timestamp('updated_at');
        });
    }
    async down() {
        this.schema.dropTable(this.tableName);
    }
}
//# sourceMappingURL=1762248543789_create_activity_display_variables_table.js.map