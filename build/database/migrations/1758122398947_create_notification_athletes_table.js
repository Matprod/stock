import { BaseSchema } from '@adonisjs/lucid/schema';
export default class extends BaseSchema {
    tableName = 'notification_athletes';
    async up() {
        this.schema.createTable(this.tableName, (table) => {
            table.increments('id');
            table
                .integer('notification_id')
                .unsigned()
                .references('id')
                .inTable('notifications')
                .onDelete('CASCADE');
            table.bigInteger('athlete_id').references('id').inTable('base_athlete').onDelete('CASCADE');
            table.timestamp('created_at');
            table.timestamp('updated_at');
            table.index(['notification_id', 'athlete_id']);
            table.unique(['notification_id', 'athlete_id']);
        });
    }
    async down() {
        this.schema.dropTable(this.tableName);
    }
}
//# sourceMappingURL=1758122398947_create_notification_athletes_table.js.map