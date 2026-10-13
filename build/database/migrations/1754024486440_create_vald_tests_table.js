import { BaseSchema } from '@adonisjs/lucid/schema';
export default class extends BaseSchema {
    tableName = 'vald_tests';
    async up() {
        this.schema.createTable(this.tableName, (table) => {
            table.increments('id').primary();
            table.bigInteger('athlete_day_id').notNullable().references('id').inTable('base_athleteday').onDelete('CASCADE');
            table.string('test_type').notNullable();
            table.string('value').nullable();
            table.timestamps(true);
        });
    }
    async down() {
        this.schema.dropTable(this.tableName);
    }
}
//# sourceMappingURL=1754024486440_create_vald_tests_table.js.map