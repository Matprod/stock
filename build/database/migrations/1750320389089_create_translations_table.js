import { BaseSchema } from '@adonisjs/lucid/schema';
export default class extends BaseSchema {
    tableName = 'translations';
    async up() {
        this.schema.createTable(this.tableName, (table) => {
            table.increments('id');
            table.enum('language', ['FR', 'EN']).notNullable();
            table.enum('translatable_type', ['insight']).notNullable();
            table.integer('translatable_id').notNullable();
            table.enum('key', ['insight_name', 'insight_description']).notNullable();
            table.text('value').notNullable();
            table.timestamp('created_at');
            table.timestamp('updated_at');
        });
    }
    async down() {
        this.schema.dropTable(this.tableName);
    }
}
//# sourceMappingURL=1750320389089_create_translations_table.js.map