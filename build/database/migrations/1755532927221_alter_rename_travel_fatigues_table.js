import { BaseSchema } from '@adonisjs/lucid/schema';
export default class extends BaseSchema {
    tableName = 'base_athletedayavg';
    async up() {
        this.schema.alterTable(this.tableName, (table) => {
            table.renameColumn('travel_fatigue', 'travel_fatigue_score');
        });
    }
    async down() {
        this.schema.alterTable(this.tableName, (table) => {
            table.renameColumn('travel_fatigue_score', 'travel_fatigue');
        });
    }
}
//# sourceMappingURL=1755532927221_alter_rename_travel_fatigues_table.js.map