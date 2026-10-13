import { DAYS } from '#constants/days.constants';
import { BaseSchema } from '@adonisjs/lucid/schema';
export default class extends BaseSchema {
    tableName = 'notifications';
    async up() {
        this.schema.createTable(this.tableName, (table) => {
            table.increments('id');
            table.string('title').notNullable();
            table.date('date');
            table.enum('day', Object.values(DAYS));
            table.time('time').notNullable();
            table.integer('club_id').unsigned().references('id').inTable('clubs').onDelete('CASCADE');
            table.timestamp('created_at');
            table.timestamp('updated_at');
        });
    }
    async down() {
        this.schema.dropTable(this.tableName);
    }
}
//# sourceMappingURL=1758118993473_create_notifications_table.js.map