import { BaseSchema } from '@adonisjs/lucid/schema';
export default class extends BaseSchema {
    tableName = 'athlete_events';
    async up() {
        this.schema.createTable(this.tableName, (table) => {
            table.increments('id');
            table.bigInteger('athlete_id').references('id').inTable('base_athlete').onDelete('CASCADE');
            table.integer('event_id').unsigned().references('id').inTable('events').onDelete('CASCADE');
            table.timestamp('created_at');
            table.timestamp('updated_at');
            table.index(['athlete_id', 'event_id']);
            table.unique(['athlete_id', 'event_id']);
        });
    }
    async down() {
        this.schema.dropTable(this.tableName);
    }
}
//# sourceMappingURL=1767632195988_create_create_athlete_events_table.js.map