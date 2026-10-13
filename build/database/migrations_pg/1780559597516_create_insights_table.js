import { BaseSchema } from '@adonisjs/lucid/schema';
export default class extends BaseSchema {
    tableName = 'insights';
    async up() {
        this.schema.createTable(this.tableName, (table) => {
            table.uuid('id').primary().notNullable().defaultTo(this.raw('uuidv7()'));
            table.string('variable_name').notNullable();
            table.string('name').notNullable();
            table.text('description').notNullable();
            table.boolean('can_too_high').notNullable();
            table.boolean('can_too_low').notNullable();
            table.float('treshold_low').nullable();
            table.float('treshold_too_low').nullable();
            table.float('treshold_high').nullable();
            table.float('treshold_too_high').nullable();
            table
                .enum('treshold_type', ['percentage', 'absolute'], {
                useNative: true,
                enumName: 'insight_treshold_type_enum',
                existingType: false,
            })
                .nullable();
            table.float('maximum').nullable();
            table.timestamps(true, true);
        });
    }
    async down() {
        this.schema.dropTable(this.tableName);
        this.schema.raw('DROP TYPE IF EXISTS insight_treshold_type_enum');
    }
}
//# sourceMappingURL=1780559597516_create_insights_table.js.map