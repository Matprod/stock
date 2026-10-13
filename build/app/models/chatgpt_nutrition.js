var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
import { DateTime } from 'luxon';
import { BaseModel, column, computed, hasMany } from '@adonisjs/lucid/orm';
import Nutrition from '#models/nutrition';
import NutritionFavorite from '#models/nutrition_favorite';
const decimalColumn = (columnName) => ({
    columnName,
    consume: (value) => value === null || value === undefined ? null : parseFloat(String(value)),
});
export default class ChatGPTNutrition extends BaseModel {
    static table = 'nutrition_chatgptnutrition';
    get nameEn() {
        return this.name;
    }
}
__decorate([
    column({ isPrimary: true }),
    __metadata("design:type", Number)
], ChatGPTNutrition.prototype, "id", void 0);
__decorate([
    computed(),
    __metadata("design:type", Object),
    __metadata("design:paramtypes", [])
], ChatGPTNutrition.prototype, "nameEn", null);
__decorate([
    column(),
    __metadata("design:type", String)
], ChatGPTNutrition.prototype, "name", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], ChatGPTNutrition.prototype, "nameFr", void 0);
__decorate([
    column.dateTime(),
    __metadata("design:type", DateTime)
], ChatGPTNutrition.prototype, "dateAdded", void 0);
__decorate([
    column.dateTime(),
    __metadata("design:type", DateTime)
], ChatGPTNutrition.prototype, "dateUpdated", void 0);
__decorate([
    column(decimalColumn('energy_kcal')),
    __metadata("design:type", Object)
], ChatGPTNutrition.prototype, "energyKcal", void 0);
__decorate([
    column(decimalColumn('water_g')),
    __metadata("design:type", Object)
], ChatGPTNutrition.prototype, "waterG", void 0);
__decorate([
    column(decimalColumn('proteins_g')),
    __metadata("design:type", Object)
], ChatGPTNutrition.prototype, "proteinsG", void 0);
__decorate([
    column(decimalColumn('carbohydrate_g')),
    __metadata("design:type", Object)
], ChatGPTNutrition.prototype, "carbohydrateG", void 0);
__decorate([
    column(decimalColumn('fat_g')),
    __metadata("design:type", Object)
], ChatGPTNutrition.prototype, "fatG", void 0);
__decorate([
    column(decimalColumn('sugars_g')),
    __metadata("design:type", Object)
], ChatGPTNutrition.prototype, "sugarsG", void 0);
__decorate([
    column(decimalColumn('fibres_g')),
    __metadata("design:type", Object)
], ChatGPTNutrition.prototype, "fibresG", void 0);
__decorate([
    column(decimalColumn('starch_g')),
    __metadata("design:type", Object)
], ChatGPTNutrition.prototype, "starchG", void 0);
__decorate([
    column(decimalColumn('gluten_g')),
    __metadata("design:type", Object)
], ChatGPTNutrition.prototype, "glutenG", void 0);
__decorate([
    column(decimalColumn('alcohol_g')),
    __metadata("design:type", Object)
], ChatGPTNutrition.prototype, "alcoholG", void 0);
__decorate([
    column(decimalColumn('fa_saturated_g')),
    __metadata("design:type", Object)
], ChatGPTNutrition.prototype, "faSaturatedG", void 0);
__decorate([
    column(decimalColumn('fa_mono_g')),
    __metadata("design:type", Object)
], ChatGPTNutrition.prototype, "faMonoG", void 0);
__decorate([
    column(decimalColumn('fa_poly_g')),
    __metadata("design:type", Object)
], ChatGPTNutrition.prototype, "faPolyG", void 0);
__decorate([
    column(decimalColumn('fa_181_g')),
    __metadata("design:type", Object)
], ChatGPTNutrition.prototype, "fa181G", void 0);
__decorate([
    column(decimalColumn('fa_182_g')),
    __metadata("design:type", Object)
], ChatGPTNutrition.prototype, "fa182G", void 0);
__decorate([
    column(decimalColumn('cholesterol_mg')),
    __metadata("design:type", Object)
], ChatGPTNutrition.prototype, "cholesterolMg", void 0);
__decorate([
    column(decimalColumn('salt_g')),
    __metadata("design:type", Object)
], ChatGPTNutrition.prototype, "saltG", void 0);
__decorate([
    column(decimalColumn('calcium_mg')),
    __metadata("design:type", Object)
], ChatGPTNutrition.prototype, "calciumMg", void 0);
__decorate([
    column(decimalColumn('chloride_mg')),
    __metadata("design:type", Object)
], ChatGPTNutrition.prototype, "chlorideMg", void 0);
__decorate([
    column(decimalColumn('copper_mg')),
    __metadata("design:type", Object)
], ChatGPTNutrition.prototype, "copperMg", void 0);
__decorate([
    column(decimalColumn('iron_mg')),
    __metadata("design:type", Object)
], ChatGPTNutrition.prototype, "ironMg", void 0);
__decorate([
    column(decimalColumn('iodine_microg')),
    __metadata("design:type", Object)
], ChatGPTNutrition.prototype, "iodineMicrog", void 0);
__decorate([
    column(decimalColumn('magnesium_mg')),
    __metadata("design:type", Object)
], ChatGPTNutrition.prototype, "magnesiumMg", void 0);
__decorate([
    column(decimalColumn('manganese_mg')),
    __metadata("design:type", Object)
], ChatGPTNutrition.prototype, "manganeseMg", void 0);
__decorate([
    column(decimalColumn('phosphorus_mg')),
    __metadata("design:type", Object)
], ChatGPTNutrition.prototype, "phosphorusMg", void 0);
__decorate([
    column(decimalColumn('potassium_mg')),
    __metadata("design:type", Object)
], ChatGPTNutrition.prototype, "potassiumMg", void 0);
__decorate([
    column(decimalColumn('selenium_microg')),
    __metadata("design:type", Object)
], ChatGPTNutrition.prototype, "seleniumMicrog", void 0);
__decorate([
    column(decimalColumn('sodium_mg')),
    __metadata("design:type", Object)
], ChatGPTNutrition.prototype, "sodiumMg", void 0);
__decorate([
    column(decimalColumn('zinc_mg')),
    __metadata("design:type", Object)
], ChatGPTNutrition.prototype, "zincMg", void 0);
__decorate([
    column(decimalColumn('vitamin_d_microg')),
    __metadata("design:type", Object)
], ChatGPTNutrition.prototype, "vitaminDMicrog", void 0);
__decorate([
    column(decimalColumn('vitamin_e_mg')),
    __metadata("design:type", Object)
], ChatGPTNutrition.prototype, "vitaminEMg", void 0);
__decorate([
    column(decimalColumn('vitamin_c_mg')),
    __metadata("design:type", Object)
], ChatGPTNutrition.prototype, "vitaminCMg", void 0);
__decorate([
    column(decimalColumn('vitamin_b1_mg')),
    __metadata("design:type", Object)
], ChatGPTNutrition.prototype, "vitaminB1Mg", void 0);
__decorate([
    column(decimalColumn('vitamin_b2_mg')),
    __metadata("design:type", Object)
], ChatGPTNutrition.prototype, "vitaminB2Mg", void 0);
__decorate([
    column(decimalColumn('vitamin_b3_mg')),
    __metadata("design:type", Object)
], ChatGPTNutrition.prototype, "vitaminB3Mg", void 0);
__decorate([
    column(decimalColumn('vitamin_b5_mg')),
    __metadata("design:type", Object)
], ChatGPTNutrition.prototype, "vitaminB5Mg", void 0);
__decorate([
    column(decimalColumn('vitamin_b6_mg')),
    __metadata("design:type", Object)
], ChatGPTNutrition.prototype, "vitaminB6Mg", void 0);
__decorate([
    column(decimalColumn('vitamin_b9_microg')),
    __metadata("design:type", Object)
], ChatGPTNutrition.prototype, "vitaminB9Microg", void 0);
__decorate([
    column(decimalColumn('vitamin_b12_microg')),
    __metadata("design:type", Object)
], ChatGPTNutrition.prototype, "vitaminB12Microg", void 0);
__decorate([
    column(decimalColumn('fructose_g')),
    __metadata("design:type", Object)
], ChatGPTNutrition.prototype, "fructoseG", void 0);
__decorate([
    column(decimalColumn('glucose_g')),
    __metadata("design:type", Object)
], ChatGPTNutrition.prototype, "glucoseG", void 0);
__decorate([
    column(decimalColumn('lactose_g')),
    __metadata("design:type", Object)
], ChatGPTNutrition.prototype, "lactoseG", void 0);
__decorate([
    column(decimalColumn('maltose_g')),
    __metadata("design:type", Object)
], ChatGPTNutrition.prototype, "maltoseG", void 0);
__decorate([
    column(decimalColumn('sucrose_g')),
    __metadata("design:type", Object)
], ChatGPTNutrition.prototype, "sucroseG", void 0);
__decorate([
    column(decimalColumn('portion')),
    __metadata("design:type", Object)
], ChatGPTNutrition.prototype, "portion", void 0);
__decorate([
    column({ columnName: 'portion_unit' }),
    __metadata("design:type", String)
], ChatGPTNutrition.prototype, "portionUnit", void 0);
__decorate([
    hasMany(() => Nutrition, {
        foreignKey: 'chatgptMealId',
    }),
    __metadata("design:type", Object)
], ChatGPTNutrition.prototype, "nutritionEntries", void 0);
__decorate([
    hasMany(() => NutritionFavorite, { foreignKey: 'chatgptFoodId' }),
    __metadata("design:type", Object)
], ChatGPTNutrition.prototype, "nutritionFavorites", void 0);
//# sourceMappingURL=chatgpt_nutrition.js.map