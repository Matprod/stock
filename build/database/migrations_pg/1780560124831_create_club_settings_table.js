import { BaseSchema } from '@adonisjs/lucid/schema';
export default class extends BaseSchema {
    tableName = 'club_settings';
    async up() {
        this.schema.createTable(this.tableName, (table) => {
            table.uuid('id').primary().notNullable().defaultTo(this.raw('uuidv7()'));
            table.float('performance_high').notNullable();
            table.float('performance_medium').notNullable();
            table.float('injury_high').notNullable();
            table.float('injury_medium').notNullable();
            table.float('availability_high').notNullable();
            table.float('availability_medium').notNullable();
            table.uuid('club_id').references('id').inTable('clubs').onDelete('CASCADE').notNullable();
            table.timestamps(true, true);
        });
    }
    async down() {
        this.schema.dropTable(this.tableName);
    }
}
//# sourceMappingURL=1780560124831_create_club_settings_table.js.map