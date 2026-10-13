import { BaseSchema } from '@adonisjs/lucid/schema';
export default class extends BaseSchema {
    tableName = 'period_metric_club_units';
    async up() {
        this.schema.createTable(this.tableName, (table) => {
            table.uuid('id').primary().notNullable().defaultTo(this.raw('uuidv7()'));
            table
                .uuid('metric_id')
                .notNullable()
                .references('id')
                .inTable('period_metrics')
                .onDelete('CASCADE');
            table.uuid('club_id').notNullable().references('id').inTable('clubs').onDelete('CASCADE');
            table.string('unit').notNullable();
            table.timestamps(true, true);
            table.unique(['metric_id', 'club_id']);
            table.index('club_id');
        });
    }
    async down() {
        this.schema.dropTable(this.tableName);
    }
}
//# sourceMappingURL=1790258908550_create_period_metric_club_units_table.js.map