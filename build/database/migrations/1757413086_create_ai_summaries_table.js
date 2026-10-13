import { BaseSchema } from '@adonisjs/lucid/schema';
export default class extends BaseSchema {
    tableName = 'ai_summaries';
    async up() {
        this.schema.createTable(this.tableName, (table) => {
            table.increments('id');
            table.integer('entity_id').nullable();
            table.enum('entity_type', ['activity', 'nutrition', 'sleep']).notNullable();
            table.integer('athlete_day_id').unsigned().notNullable();
            table.text('summary_message').notNullable();
            table.timestamp('created_at');
            table.timestamp('updated_at');
            table.index(['athlete_day_id', 'entity_type']);
            table.index(['entity_id', 'entity_type']);
        });
    }
    async down() {
        this.schema.dropTable(this.tableName);
    }
}
//# sourceMappingURL=1757413086_create_ai_summaries_table.js.map