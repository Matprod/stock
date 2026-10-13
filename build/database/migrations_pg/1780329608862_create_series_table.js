import { BaseSchema } from '@adonisjs/lucid/schema';
export default class extends BaseSchema {
    tableName = 'series';
    async up() {
        this.schema.createTable(this.tableName, (table) => {
            table.uuid('id').primary().notNullable().defaultTo(this.raw('uuidv7()'));
            table.string('type').notNullable();
            table.text('data_encoded', 'longtext').notNullable();
            table
                .enum('data_type', ['unsigned', 'float', 'signed'], {
                useNative: true,
                enumName: 'data_type_numeric_enum',
                existingType: false,
            })
                .defaultTo('unsigned')
                .notNullable();
            table.uuid('period_id').notNullable().references('id').inTable('periods').onDelete('CASCADE');
            table.timestamps(true, true);
        });
    }
    async down() {
        this.schema.raw('DROP TYPE IF EXISTS data_type_numeric_enum');
        this.schema.dropTable(this.tableName);
    }
}
//# sourceMappingURL=1780329608862_create_series_table.js.map