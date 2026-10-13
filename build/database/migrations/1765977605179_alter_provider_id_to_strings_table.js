import { BaseSchema } from '@adonisjs/lucid/schema';
export default class extends BaseSchema {
    tableName = 'athlete_providers';
    async up() {
        this.schema.alterTable(this.tableName, (table) => {
            table.string('provider_athlete_id').nullable().alter();
        });
    }
    async down() {
        this.schema.alterTable(this.tableName, (table) => {
            table.integer('provider_athlete_id').nullable().alter();
        });
    }
}
//# sourceMappingURL=1765977605179_alter_provider_id_to_strings_table.js.map