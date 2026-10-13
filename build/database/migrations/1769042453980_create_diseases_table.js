import { BaseSchema } from '@adonisjs/lucid/schema';
export default class extends BaseSchema {
    tableName = 'diseases';
    async up() {
        this.schema.createTable(this.tableName, (table) => {
            table.increments('id');
            table.date('date_of_disease').nullable();
            table.date('recovery_date').nullable();
            table.text('note').nullable();
            table.bigint('athlete_id').references('id').inTable('base_athlete').onDelete('CASCADE');
            table.integer('type_of_disease_id').unsigned().notNullable().references('id').inTable('disease_types').onDelete('CASCADE');
            table.timestamp('created_at', { useTz: true });
            table.timestamp('updated_at', { useTz: true });
        });
    }
    async down() {
        this.schema.dropTable(this.tableName);
    }
}
//# sourceMappingURL=1769042453980_create_diseases_table.js.map