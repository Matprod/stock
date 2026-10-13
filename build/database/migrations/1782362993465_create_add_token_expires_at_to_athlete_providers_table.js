import { BaseSchema } from '@adonisjs/lucid/schema';
export default class extends BaseSchema {
    tableName = 'athlete_providers';
    async up() {
        this.schema.alterTable(this.tableName, (table) => {
            table.timestamp('token_expires_at').nullable();
        });
    }
    async down() {
        this.schema.alterTable(this.tableName, (table) => {
            table.dropColumn('token_expires_at');
        });
    }
}
//# sourceMappingURL=1782362993465_create_add_token_expires_at_to_athlete_providers_table.js.map