import { BaseSchema } from '@adonisjs/lucid/schema';
export default class extends BaseSchema {
    tableName = 'llm_aliments';
    async up() {
        this.schema.createTable(this.tableName, (table) => {
            table.uuid('id').primary().notNullable().defaultTo(this.raw('uuidv7()'));
            table.string('name').notNullable();
            table.decimal('energy_kcal');
            table.decimal('water_g');
            table.decimal('proteins_g');
            table.decimal('carbohydrate_g');
            table.decimal('fat_g');
            table.decimal('sugars_g');
            table.decimal('fibres_g');
            table.decimal('starch_g');
            table.decimal('gluten_g');
            table.decimal('alcohol_g');
            table.decimal('fa_saturated_g');
            table.decimal('fa_mono_g');
            table.decimal('fa_poly_g');
            table.decimal('fa_181_g');
            table.decimal('fa_182_g');
            table.decimal('cholesterol_mg');
            table.decimal('salt_g');
            table.decimal('calcium_mg');
            table.decimal('chloride_mg');
            table.decimal('copper_mg');
            table.decimal('iron_mg');
            table.decimal('iodine_microg');
            table.decimal('magnesium_mg');
            table.decimal('manganese_mg');
            table.decimal('phosphorus_mg');
            table.decimal('potassium_mg');
            table.decimal('selenium_microg');
            table.decimal('sodium_mg');
            table.decimal('zinc_mg');
            table.decimal('vitamin_d_microg');
            table.decimal('vitamin_e_mg');
            table.decimal('vitamin_c_mg');
            table.decimal('vitamin_b1_mg');
            table.decimal('vitamin_b2_mg');
            table.decimal('vitamin_b3_mg');
            table.decimal('vitamin_b5_mg');
            table.decimal('vitamin_b6_mg');
            table.decimal('vitamin_b9_microg');
            table.decimal('vitamin_b12_microg');
            table.decimal('fructose_g');
            table.decimal('glucose_g');
            table.decimal('lactose_g');
            table.decimal('maltose_g');
            table.decimal('sucrose_g');
            table.decimal('portion');
            table.string('portion_unit').defaultTo('g');
            table.timestamps(true, true);
        });
    }
    async down() {
        this.schema.dropTable(this.tableName);
    }
}
//# sourceMappingURL=1780400083991_create_llm_aliments_table.js.map