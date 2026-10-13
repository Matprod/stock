import { BaseSchema } from '@adonisjs/lucid/schema';
export default class extends BaseSchema {
    tableName = 'chatbot_reports';
    async up() {
        this.schema.alterTable(this.tableName, (table) => {
            table.text('summary').alter();
        });
    }
    async down() {
        this.schema.alterTable(this.tableName, (table) => {
            table.string('summary').alter();
        });
    }
}
//# sourceMappingURL=1775148673052_alter_report_summary_texts_table.js.map