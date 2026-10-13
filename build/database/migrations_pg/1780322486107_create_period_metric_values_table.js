import { BaseSchema } from '@adonisjs/lucid/schema';
export default class extends BaseSchema {
    tableName = 'period_metric_values';
    async up() {
        this.schema.createTable(this.tableName, (table) => {
            table.uuid('id').primary().notNullable().defaultTo(this.raw('uuidv7()'));
            table.uuid('period_id').notNullable().references('id').inTable('periods').onDelete('CASCADE');
            table
                .uuid('metric_id')
                .notNullable()
                .references('id')
                .inTable('period_metrics')
                .onDelete('CASCADE');
            table.string('value').notNullable();
            table.timestamps(true, true);
            table.unique(['period_id', 'metric_id']);
        });
    }
    async down() {
        this.schema.dropTable(this.tableName);
    }
}
//# sourceMappingURL=1780322486107_create_period_metric_values_table.js.map