import { BaseSchema } from '@adonisjs/lucid/schema';
export default class extends BaseSchema {
    tableName = 'club_thresholds';
    async up() {
        this.schema.createTable(this.tableName, (table) => {
            table.increments('id');
            table
                .integer('club_id')
                .unsigned()
                .nullable()
                .references('id')
                .inTable('clubs')
                .onDelete('CASCADE');
            table.integer('performance_high').notNullable();
            table.integer('performance_medium').notNullable();
            table.integer('injury_high').notNullable();
            table.integer('injury_medium').notNullable();
            table.integer('availability_high').notNullable();
            table.integer('availability_medium').notNullable();
            table.timestamp('created_at', { useTz: true });
            table.timestamp('updated_at', { useTz: true });
            table.unique(['club_id']);
        });
    }
    async down() {
        this.schema.dropTable(this.tableName);
    }
}
//# sourceMappingURL=1777037774200_create_club_thresholds_table.js.map