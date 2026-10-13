import { BaseSchema } from '@adonisjs/lucid/schema';
export default class AddFatPercentageToAthlete extends BaseSchema {
    tableName = 'base_athlete';
    async up() {
        this.schema.alterTable(this.tableName, (table) => {
            table.decimal('fat_percentage', 5, 2).nullable();
        });
    }
    async down() {
        this.schema.alterTable(this.tableName, (table) => {
            table.dropColumn('fat_percentage');
        });
    }
}
//# sourceMappingURL=1743543323881_add_fat_percentage_to_athlete.js.map