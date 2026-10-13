import { ATHLETE_PROVIDER_SOURCE } from '#constants/athlete_provider.constants';
import { BaseSchema } from '@adonisjs/lucid/schema';
export default class extends BaseSchema {
    tableName = 'base_injuryhistory';
    async up() {
        this.schema.alterTable(this.tableName, (table) => {
            table.string('source').notNullable().defaultTo(ATHLETE_PROVIDER_SOURCE.MANUAL);
        });
    }
    async down() {
        this.schema.alterTable(this.tableName, (table) => {
            table.dropColumn('source');
        });
    }
}
//# sourceMappingURL=1774348071618_alter_add_source_base_injuryhistories_table.js.map