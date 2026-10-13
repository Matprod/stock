import { BaseSchema } from '@adonisjs/lucid/schema';
export default class extends BaseSchema {
    tableName = 'periods';
    async up() {
        this.schema.createTable(this.tableName, (table) => {
            table.increments('id');
            table.string('provider_id').nullable();
            table.string('name').nullable();
            table.dateTime('start_time', { useTz: true }).nullable();
            table.dateTime('end_time', { useTz: true }).nullable();
            table
                .bigint('sport_activity_id')
                .notNullable()
                .references('id')
                .inTable('sportactivity_sportactivity')
                .onDelete('CASCADE');
            table.timestamp('created_at');
            table.timestamp('updated_at');
        });
    }
    async down() {
        this.schema.dropTable(this.tableName);
    }
}
//# sourceMappingURL=1761254397510_create_periods_table.js.map