import { BaseSchema } from '@adonisjs/lucid/schema';
export default class extends BaseSchema {
    tableName = 'sport_activities';
    async up() {
        this.schema.alterTable(this.tableName, (table) => {
            table.string('activity_name').nullable();
        });
    }
    async down() {
        this.schema.alterTable(this.tableName, (table) => {
            table.dropColumn('activity_name');
        });
    }
}
//# sourceMappingURL=1784800000000_alter_sport_activities_add_activity_name.js.map