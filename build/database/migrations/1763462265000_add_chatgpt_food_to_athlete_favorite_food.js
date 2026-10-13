import { BaseSchema } from '@adonisjs/lucid/schema';
export default class AddChatGPTFoodToAthleteFavoriteFood extends BaseSchema {
    tableName = 'nutrition_athletefavoritefood';
    async up() {
        this.schema.alterTable(this.tableName, (table) => {
            table
                .integer('chatgpt_food_id')
                .unsigned()
                .nullable()
                .references('id')
                .inTable('nutrition_chatgptnutrition')
                .onDelete('CASCADE');
        });
    }
    async down() {
        this.schema.alterTable(this.tableName, (table) => {
            table.dropForeign(['chatgpt_food_id']);
            table.dropColumn('chatgpt_food_id');
        });
    }
}
//# sourceMappingURL=1763462265000_add_chatgpt_food_to_athlete_favorite_food.js.map