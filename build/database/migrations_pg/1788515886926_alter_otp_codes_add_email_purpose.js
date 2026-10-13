import { BaseSchema } from '@adonisjs/lucid/schema';
export default class extends BaseSchema {
    tableName = 'otp_codes';
    async up() {
        this.schema.alterTable(this.tableName, (table) => {
            table.string('email').nullable();
            table.string('purpose').nullable();
            table.index(['email', 'purpose']);
        });
    }
    async down() {
        this.schema.alterTable(this.tableName, (table) => {
            table.dropIndex(['email', 'purpose']);
            table.dropColumn('email');
            table.dropColumn('purpose');
        });
    }
}
//# sourceMappingURL=1788515886926_alter_otp_codes_add_email_purpose.js.map