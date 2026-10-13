import { BaseSchema } from '@adonisjs/lucid/schema';
export default class extends BaseSchema {
    tableName = 'demo_pairs';
    async up() {
        this.schema.createTable(this.tableName, (table) => {
            table.uuid('id').primary().notNullable().defaultTo(this.raw('uuidv7()'));
            table.text('question').notNullable();
            table.text('answer').notNullable();
            table
                .enum('category', ['performance', 'injury'], {
                useNative: true,
                enumName: 'prediction_type_enum',
                existingType: true,
            })
                .nullable();
            table.date('reference_date').nullable();
            table.boolean('is_active').notNullable().defaultTo(true);
            table.jsonb('embedding').nullable();
            table.jsonb('variants').nullable();
            table.jsonb('variant_embeddings').nullable();
            table.jsonb('chart_data').nullable();
            table.timestamps(true, true);
            table.index(['is_active']);
            table.index(['category', 'reference_date']);
        });
    }
    async down() {
        this.schema.dropTable(this.tableName);
    }
}
//# sourceMappingURL=1784716533955_create_demo_pairs_table.js.map