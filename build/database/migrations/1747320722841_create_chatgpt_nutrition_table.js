import { BaseSchema } from '@adonisjs/lucid/schema';
export default class CreateChatGPTNutritionTable extends BaseSchema {
    tableName = 'nutrition_chatgptnutrition';
    async up() {
        this.schema.createTable(this.tableName, (table) => {
            table.increments('id');
            table.string('name', 300).notNullable();
            table.timestamp('date_added').defaultTo(this.now());
            table.timestamp('date_updated').defaultTo(this.now());
            table.decimal('energy_kcal', 10, 2).nullable();
            table.decimal('water_g', 10, 2).nullable();
            table.decimal('proteins_g', 10, 2).nullable();
            table.decimal('carbohydrate_g', 10, 2).nullable();
            table.decimal('fat_g', 10, 2).nullable();
            table.decimal('sugars_g', 10, 2).nullable();
            table.decimal('fibres_g', 10, 2).nullable();
            table.decimal('starch_g', 10, 2).nullable();
            table.decimal('gluten_g', 10, 2).nullable();
            table.decimal('alcohol_g', 10, 2).nullable();
            table.decimal('fa_saturated_g', 10, 2).nullable();
            table.decimal('fa_mono_g', 10, 2).nullable();
            table.decimal('fa_poly_g', 10, 2).nullable();
            table.decimal('fa_181_g', 10, 2).nullable();
            table.decimal('fa_182_g', 10, 2).nullable();
            table.decimal('cholesterol_mg', 10, 2).nullable();
            table.decimal('salt_g', 10, 2).nullable();
            table.decimal('calcium_mg', 10, 2).nullable();
            table.decimal('chloride_mg', 10, 2).nullable();
            table.decimal('copper_mg', 10, 2).nullable();
            table.decimal('iron_mg', 10, 2).nullable();
            table.decimal('iodine_microg', 10, 2).nullable();
            table.decimal('magnesium_mg', 10, 2).nullable();
            table.decimal('manganese_mg', 10, 2).nullable();
            table.decimal('phosphorus_mg', 10, 2).nullable();
            table.decimal('potassium_mg', 10, 2).nullable();
            table.decimal('selenium_microg', 10, 2).nullable();
            table.decimal('sodium_mg', 10, 2).nullable();
            table.decimal('zinc_mg', 10, 2).nullable();
            table.decimal('vitamin_d_microg', 10, 2).nullable();
            table.decimal('vitamin_e_mg', 10, 2).nullable();
            table.decimal('vitamin_c_mg', 10, 2).nullable();
            table.decimal('vitamin_b1_mg', 10, 2).nullable();
            table.decimal('vitamin_b2_mg', 10, 2).nullable();
            table.decimal('vitamin_b3_mg', 10, 2).nullable();
            table.decimal('vitamin_b5_mg', 10, 2).nullable();
            table.decimal('vitamin_b6_mg', 10, 2).nullable();
            table.decimal('vitamin_b9_microg', 10, 2).nullable();
            table.decimal('vitamin_b12_microg', 10, 2).nullable();
            table.decimal('fructose_g', 10, 2).nullable();
            table.decimal('glucose_g', 10, 2).nullable();
            table.decimal('lactose_g', 10, 2).nullable();
            table.decimal('maltose_g', 10, 2).nullable();
            table.decimal('sucrose_g', 10, 2).nullable();
            table.decimal('portion', 10, 2).nullable();
            table.string('portion_unit', 10).defaultTo('g');
        });
        this.schema.alterTable('nutrition_nutrition', (table) => {
            table.integer('chatgpt_meal_id').unsigned().references('id').inTable('nutrition_chatgptnutrition').onDelete('CASCADE');
        });
    }
    async down() {
        this.schema.alterTable('nutrition_nutrition', (table) => {
            table.dropForeign(['chatgpt_meal_id']);
            table.dropColumn('chatgpt_meal_id');
        });
        this.schema.dropTable(this.tableName);
    }
}
//# sourceMappingURL=1747320722841_create_chatgpt_nutrition_table.js.map