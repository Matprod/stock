import { BaseSchema } from '@adonisjs/lucid/schema';
export default class AddNutritionIdToFoodIntake extends BaseSchema {
    tableName = 'sportactivity_foodintake';
    async up() {
        this.schema.alterTable(this.tableName, (table) => {
            table
                .bigInteger('nutrition_id')
                .nullable()
                .references('id')
                .inTable('nutrition_nutrition')
                .onDelete('CASCADE');
        });
    }
    async down() {
        this.schema.alterTable(this.tableName, (table) => {
            table.dropForeign(['nutrition_id']);
            table.dropColumn('nutrition_id');
        });
    }
}
//# sourceMappingURL=1763042402_add_nutrition_id_to_food_intake.js.map