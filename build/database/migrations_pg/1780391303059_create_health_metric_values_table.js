import { BaseSchema } from '@adonisjs/lucid/schema';
export default class extends BaseSchema {
    tableName = 'health_metric_values';
    async up() {
        this.schema.createTable(this.tableName, (table) => {
            table.uuid('id').primary().notNullable().defaultTo(this.raw('uuidv7()'));
            table.string('value').notNullable();
            table
                .uuid('metric_id')
                .notNullable()
                .references('id')
                .inTable('health_metrics')
                .onDelete('CASCADE');
            table
                .uuid('health_id')
                .notNullable()
                .references('id')
                .inTable('health_ratings')
                .onDelete('CASCADE');
            table.timestamps(true, true);
        });
    }
    async down() {
        this.schema.dropTable(this.tableName);
    }
}
//# sourceMappingURL=1780391303059_create_health_metric_values_table.js.map