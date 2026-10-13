import { BaseSchema } from '@adonisjs/lucid/schema';
export default class extends BaseSchema {
    tableName = 'subjective_field_configs';
    async up() {
        this.schema.createTable(this.tableName, (table) => {
            table.increments('id');
            table
                .integer('club_settings_id')
                .unsigned()
                .notNullable()
                .references('id')
                .inTable('club_settings');
            table.string('field_id').notNullable();
            table.string('name').notNullable();
            table.text('description').notNullable();
            table.integer('max_scale').unsigned().notNullable().defaultTo(10);
            table.unique(['club_settings_id', 'field_id']);
            table.integer('min_scale').unsigned().notNullable().defaultTo(1);
            table.boolean('is_reversed').notNullable().defaultTo(false);
            table.timestamp('created_at');
            table.timestamp('updated_at');
        });
    }
    async down() {
        this.schema.dropTable(this.tableName);
    }
}
//# sourceMappingURL=1778482902547_create_subjective_field_configs_table.js.map