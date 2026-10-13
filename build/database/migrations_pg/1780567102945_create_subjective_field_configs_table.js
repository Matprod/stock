import { BaseSchema } from '@adonisjs/lucid/schema';
export default class extends BaseSchema {
    tableName = 'subjective_field_configs';
    async up() {
        this.schema.createTable(this.tableName, (table) => {
            table.uuid('id').primary().notNullable().defaultTo(this.raw('uuidv7()'));
            table.uuid('club_id').notNullable().references('id').inTable('clubs').onDelete('CASCADE');
            table.string('field_id').notNullable();
            table.integer('min_scale').notNullable().defaultTo(1);
            table.integer('max_scale').notNullable().defaultTo(10);
            table.boolean('is_reversed').notNullable().defaultTo(false);
            table.timestamps(true, true);
            table.unique(['club_id', 'field_id']);
            table.index('club_id');
        });
    }
    async down() {
        this.schema.dropTable(this.tableName);
    }
}
//# sourceMappingURL=1780567102945_create_subjective_field_configs_table.js.map