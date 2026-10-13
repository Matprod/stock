import { INSIGHT_CATEGORIES } from '#constants/insight.constants';
import { BaseSchema } from '@adonisjs/lucid/schema';
export default class extends BaseSchema {
    tableName = 'priority_category_weights';
    async up() {
        this.schema.createTable(this.tableName, (table) => {
            table.increments('id');
            table
                .integer('club_id')
                .nullable()
                .unsigned()
                .references('id')
                .inTable('clubs')
                .onDelete('CASCADE');
            table.enum('category_type', ['activity', 'sleep', 'nutrition', 'health']).notNullable();
            table.enum('type', [...INSIGHT_CATEGORIES]).notNullable().defaultTo('performance');
            table.decimal('weight', 5, 4).notNullable();
            table.timestamp('created_at', { useTz: true });
            table.timestamp('updated_at', { useTz: true });
            table.index(['club_id', 'category_type']);
            table.unique(['club_id', 'category_type', 'type']);
        });
    }
    async down() {
        this.schema.dropTable(this.tableName);
    }
}
//# sourceMappingURL=1764080118065_create_priority_category_weights_table.js.map