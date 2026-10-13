import { BaseSchema } from '@adonisjs/lucid/schema';
export default class extends BaseSchema {
    tableName = 'aliments';
    async up() {
        this.schema.createTable(this.tableName, (table) => {
            table.uuid('id').primary().notNullable().defaultTo(this.raw('uuidv7()'));
            table.integer('alim_code');
            table.string('name');
            table.double('portion');
            table.string('portion_unit');
            table.string('reference_database');
            table.string('modificated');
            table.double('energy_kcal');
            table.double('water_g');
            table.double('proteins_g');
            table.double('carbohydrate_g');
            table.double('fat_g');
            table.double('gluten_g');
            table.double('sugars_g');
            table.double('fructose_g');
            table.double('galactose_g');
            table.double('glucose_g');
            table.double('lactose_g');
            table.double('maltose_g');
            table.double('sucrose_g');
            table.double('starch_g');
            table.double('fibres_g');
            table.double('alcohol_g');
            table.double('FA_saturated_g');
            table.double('FA_mono_g');
            table.double('FA_poly_g');
            table.double('FA_181_g');
            table.double('FA_182_g');
            table.double('cholesterol_mg');
            table.double('salt_g');
            table.double('calcium_mg');
            table.double('chloride_mg');
            table.double('copper_mg');
            table.double('iron_mg');
            table.double('iodine_microg');
            table.double('magnesium_mg');
            table.double('manganese_mg');
            table.double('phosphorus_mg');
            table.double('potassium_mg');
            table.double('selenium_microg');
            table.double('sodium_mg');
            table.double('zinc_mg');
            table.double('vitamin_D_microg');
            table.double('vitamin_E_mg');
            table.double('vitamin_C_mg');
            table.double('vitamin_B1_mg');
            table.double('vitamin_B2_mg');
            table.double('vitamin_B3_mg');
            table.double('vitamin_B5_mg');
            table.double('vitamin_B6_mg');
            table.double('vitamin_B9_microg');
            table.double('vitamin_B12_microg');
            table.string('barcode', 255);
            table.integer('position');
            table.float('popularity_score').notNullable().defaultTo(0.5);
            table.uuid('athlete_id').references('id').inTable('athletes').onDelete('SET NULL');
            table.timestamps(true, true);
        });
    }
    async down() {
        this.schema.dropTable(this.tableName);
    }
}
//# sourceMappingURL=1780396645477_create_aliments_table.js.map