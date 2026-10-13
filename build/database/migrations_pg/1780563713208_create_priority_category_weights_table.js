import { BaseSchema } from '@adonisjs/lucid/schema';
export default class extends BaseSchema {
    tableName = 'priority_category_weights';
    async up() {
        this.schema.createTable(this.tableName, (table) => {
            table.uuid('id').primary().notNullable().defaultTo(this.raw('uuidv7()'));
            table
                .enum('type', ['performance', 'injury'], {
                useNative: true,
                enumName: 'prediction_type_enum',
                existingType: true,
            })
                .defaultTo('performance')
                .notNullable();
            table
                .enum('category_type', ['activity', 'health', 'sleep', 'nutrition'], {
                useNative: true,
                enumName: 'entity_type_enum',
                existingType: true,
            })
                .notNullable();
            table.float('weight').notNullable();
            table.uuid('club_id').references('id').inTable('clubs').onDelete('CASCADE').nullable();
            table.timestamp('created_at');
            table.timestamp('updated_at');
        });
    }
    async down() {
        this.schema.dropTable(this.tableName);
    }
}
//# sourceMappingURL=1780563713208_create_priority_category_weights_table.js.map