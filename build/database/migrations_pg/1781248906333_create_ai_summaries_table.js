import { BaseSchema } from '@adonisjs/lucid/schema';
export default class extends BaseSchema {
    tableName = 'ai_summaries';
    async up() {
        this.schema.createTable(this.tableName, (table) => {
            table.uuid('id').primary().notNullable().defaultTo(this.raw('uuidv7()'));
            table.uuid('entity_id').nullable();
            table
                .enum('entity_type', ['activity', 'health', 'sleep', 'nutrition'], {
                useNative: true,
                enumName: 'entity_type_enum',
                existingType: true,
            })
                .notNullable();
            table.uuid('day_id').references('id').inTable('days').onDelete('CASCADE').notNullable();
            table.text('summary').notNullable();
            table.timestamps(true, true);
        });
    }
    async down() {
        this.schema.dropTable(this.tableName);
    }
}
//# sourceMappingURL=1781248906333_create_ai_summaries_table.js.map