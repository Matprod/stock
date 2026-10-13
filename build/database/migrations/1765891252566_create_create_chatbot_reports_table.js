import { INSIGHT_CATEGORIES } from '#constants/insight.constants';
import { BaseSchema } from '@adonisjs/lucid/schema';
export default class extends BaseSchema {
    tableName = 'chatbot_reports';
    async up() {
        this.schema.createTable(this.tableName, (table) => {
            table.increments('id');
            table
                .bigInteger('day_id')
                .references('id')
                .inTable('base_athleteday')
                .onDelete('CASCADE')
                .notNullable();
            table.enum('category', [...INSIGHT_CATEGORIES]).notNullable();
            table.text('report_message').notNullable();
            table.integer('score_at_generation').nullable();
            table.timestamp('created_at');
            table.timestamp('updated_at');
            table.index(['day_id', 'category', 'created_at'], 'chatbot_reports_latest_idx');
        });
    }
    async down() {
        this.schema.dropTable(this.tableName);
    }
}
//# sourceMappingURL=1765891252566_create_create_chatbot_reports_table.js.map