import { BaseSchema } from '@adonisjs/lucid/schema';
export default class extends BaseSchema {
    tableName = 'days';
    async up() {
        this.schema.createTable(this.tableName, (table) => {
            table.uuid('id').primary().notNullable().defaultTo(this.raw('uuidv7()'));
            table.date('date_of_day').notNullable();
            table.integer('performance_score').nullable();
            table.integer('injury_risk_score').nullable();
            table
                .uuid('athlete_id')
                .notNullable()
                .references('id')
                .inTable('athletes')
                .onDelete('CASCADE');
            table.unique(['athlete_id', 'date_of_day']);
            table.timestamps(true, true);
        });
    }
    async down() {
        this.schema.dropTable(this.tableName);
    }
}
//# sourceMappingURL=1780300364041_create_days_table.js.map