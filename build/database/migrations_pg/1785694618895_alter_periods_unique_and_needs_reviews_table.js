import { BaseSchema } from '@adonisjs/lucid/schema';
export default class extends BaseSchema {
    async up() {
        this.schema.alterTable('periods', (table) => {
            table.dropUnique(['sport_activity_id', 'start_time', 'end_time']);
            table.unique(['sport_activity_id', 'provider_id']);
            table.boolean('needs_review').notNullable().defaultTo(false);
        });
        this.schema.alterTable('sport_activities', (table) => {
            table.boolean('needs_review').notNullable().defaultTo(false);
        });
    }
    async down() {
        this.schema.alterTable('sport_activities', (table) => {
            table.dropColumn('needs_review');
        });
        this.schema.alterTable('periods', (table) => {
            table.dropColumn('needs_review');
            table.dropUnique(['sport_activity_id', 'provider_id']);
            table.unique(['sport_activity_id', 'start_time', 'end_time']);
        });
    }
}
//# sourceMappingURL=1785694618895_alter_periods_unique_and_needs_reviews_table.js.map