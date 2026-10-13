import { BaseSchema } from '@adonisjs/lucid/schema';
export default class extends BaseSchema {
    tableName = 'health_ratings';
    async up() {
        this.schema.createTable(this.tableName, (table) => {
            table.uuid('id').primary().notNullable().defaultTo(this.raw('uuidv7()'));
            table.integer('energy_rating').nullable();
            table.integer('mood_rating').nullable();
            table.integer('stress_rating').nullable();
            table.integer('wellbeing_rating').nullable();
            table.integer('body_soreness_rating').nullable();
            table.uuid('day_id').notNullable().references('id').inTable('days').onDelete('CASCADE');
            table.timestamps(true, true);
            table.check('energy_rating >= 0', [], 'check_energy_rating_unsigned');
            table.check('mood_rating >= 0', [], 'check_mood_rating_unsigned');
            table.check('stress_rating >= 0', [], 'check_stress_rating_unsigned');
            table.check('wellbeing_rating >= 0', [], 'check_wellbeing_rating_unsigned');
            table.check('body_soreness_rating >= 0', [], 'check_body_soreness_rating_unsigned');
        });
    }
    async down() {
        this.schema.dropTable(this.tableName);
    }
}
//# sourceMappingURL=1780388595954_create_health_table.js.map