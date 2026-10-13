import { BaseSchema } from '@adonisjs/lucid/schema';
export default class extends BaseSchema {
    tableName = 'sleep_metric_values';
    async up() {
        this.schema.createTable(this.tableName, (table) => {
            table.uuid('id').primary().notNullable().defaultTo(this.raw('uuidv7()'));
            table.uuid('sleep_id').references('id').inTable('sleeps').onDelete('CASCADE').notNullable();
            table
                .uuid('metric_id')
                .references('id')
                .inTable('sleep_metrics')
                .onDelete('CASCADE')
                .notNullable();
            table.string('value').notNullable();
            table.timestamps(true, true);
            table.unique(['sleep_id', 'metric_id']);
        });
    }
    async down() {
        this.schema.dropTable(this.tableName);
    }
}
//# sourceMappingURL=1780587616684_create_sleep_metric_values_table.js.map