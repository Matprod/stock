import { BaseSchema } from '@adonisjs/lucid/schema';
export default class extends BaseSchema {
    tableName = 'period_metrics';
    async up() {
        this.schema.createTable(this.tableName, (table) => {
            table.uuid('id').primary().notNullable().defaultTo(this.raw('uuidv7()'));
            table.string('name').notNullable().unique();
            table.text('description').nullable();
            table.string('unit').nullable();
            table
                .enum('data_type', ['float', 'integer', 'string', 'boolean'], {
                useNative: true,
                enumName: 'data_type_enum',
                existingType: false,
            })
                .notNullable();
            table
                .enum('aggregation_method', ['sum', 'average', 'max', 'min'], {
                useNative: true,
                enumName: 'aggregation_method_enum',
                existingType: false,
            })
                .notNullable();
            table.timestamps(true, true);
        });
    }
    async down() {
        this.schema.dropTable(this.tableName);
        this.schema.raw('DROP TYPE IF EXISTS data_type_numeric_enum');
        this.schema.raw('DROP TYPE IF EXISTS aggregation_method_enum');
    }
}
//# sourceMappingURL=1780321939336_create_period_metrics_table.js.map