var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
import { BaseModel, column, belongsTo, hasMany, computed } from '@adonisjs/lucid/orm';
import Athlete from '#models/athlete';
import AlimentSubgroup from '#models/aliment_subgroup';
import NutritionFavorite from '#models/nutrition_favorite';
export default class Aliment extends BaseModel {
    static table = 'nutrition_aliment';
    get nameEn() {
        return this.alimNomEng;
    }
    get nameFr() {
        return this.alimNomFr;
    }
}
__decorate([
    column({ isPrimary: true }),
    __metadata("design:type", Number)
], Aliment.prototype, "id", void 0);
__decorate([
    column({ columnName: 'alim_code' }),
    __metadata("design:type", Object)
], Aliment.prototype, "alimCode", void 0);
__decorate([
    computed(),
    __metadata("design:type", Object),
    __metadata("design:paramtypes", [])
], Aliment.prototype, "nameEn", null);
__decorate([
    computed(),
    __metadata("design:type", Object),
    __metadata("design:paramtypes", [])
], Aliment.prototype, "nameFr", null);
__decorate([
    column({ columnName: 'alim_nom_fr' }),
    __metadata("design:type", Object)
], Aliment.prototype, "alimNomFr", void 0);
__decorate([
    column({ columnName: 'alim_nom_eng' }),
    __metadata("design:type", Object)
], Aliment.prototype, "alimNomEng", void 0);
__decorate([
    column({ columnName: 'portion' }),
    __metadata("design:type", Object)
], Aliment.prototype, "portion", void 0);
__decorate([
    column({ columnName: 'portion_unit' }),
    __metadata("design:type", Object)
], Aliment.prototype, "portionUnit", void 0);
__decorate([
    column({ columnName: 'reference_database' }),
    __metadata("design:type", Object)
], Aliment.prototype, "referenceDatabase", void 0);
__decorate([
    column({ columnName: 'modificated' }),
    __metadata("design:type", Object)
], Aliment.prototype, "modificated", void 0);
__decorate([
    column({ columnName: 'energy_kcal' }),
    __metadata("design:type", Object)
], Aliment.prototype, "energyKcal", void 0);
__decorate([
    column({ columnName: 'water_g' }),
    __metadata("design:type", Object)
], Aliment.prototype, "waterG", void 0);
__decorate([
    column({ columnName: 'proteins_g' }),
    __metadata("design:type", Object)
], Aliment.prototype, "proteinsG", void 0);
__decorate([
    column({ columnName: 'carbohydrate_g' }),
    __metadata("design:type", Object)
], Aliment.prototype, "carbohydrateG", void 0);
__decorate([
    column({ columnName: 'fat_g' }),
    __metadata("design:type", Object)
], Aliment.prototype, "fatG", void 0);
__decorate([
    column({ columnName: 'gluten_g' }),
    __metadata("design:type", Object)
], Aliment.prototype, "glutenG", void 0);
__decorate([
    column({ columnName: 'sugars_g' }),
    __metadata("design:type", Object)
], Aliment.prototype, "sugarsG", void 0);
__decorate([
    column({ columnName: 'fructose_g' }),
    __metadata("design:type", Object)
], Aliment.prototype, "fructoseG", void 0);
__decorate([
    column({ columnName: 'galactose_g' }),
    __metadata("design:type", Object)
], Aliment.prototype, "galactoseG", void 0);
__decorate([
    column({ columnName: 'glucose_g' }),
    __metadata("design:type", Object)
], Aliment.prototype, "glucoseG", void 0);
__decorate([
    column({ columnName: 'lactose_g' }),
    __metadata("design:type", Object)
], Aliment.prototype, "lactoseG", void 0);
__decorate([
    column({ columnName: 'maltose_g' }),
    __metadata("design:type", Object)
], Aliment.prototype, "maltoseG", void 0);
__decorate([
    column({ columnName: 'sucrose_g' }),
    __metadata("design:type", Object)
], Aliment.prototype, "sucroseG", void 0);
__decorate([
    column({ columnName: 'starch_g' }),
    __metadata("design:type", Object)
], Aliment.prototype, "starchG", void 0);
__decorate([
    column({ columnName: 'fibres_g' }),
    __metadata("design:type", Object)
], Aliment.prototype, "fibresG", void 0);
__decorate([
    column({ columnName: 'alcohol_g' }),
    __metadata("design:type", Object)
], Aliment.prototype, "alcoholG", void 0);
__decorate([
    column({ columnName: 'FA_saturated_g' }),
    __metadata("design:type", Object)
], Aliment.prototype, "faSaturatedG", void 0);
__decorate([
    column({ columnName: 'FA_mono_g' }),
    __metadata("design:type", Object)
], Aliment.prototype, "faMonoG", void 0);
__decorate([
    column({ columnName: 'FA_poly_g' }),
    __metadata("design:type", Object)
], Aliment.prototype, "faPolyG", void 0);
__decorate([
    column({ columnName: 'FA_181_g' }),
    __metadata("design:type", Object)
], Aliment.prototype, "fa181G", void 0);
__decorate([
    column({ columnName: 'FA_182_g' }),
    __metadata("design:type", Object)
], Aliment.prototype, "fa182G", void 0);
__decorate([
    column({ columnName: 'cholesterol_mg' }),
    __metadata("design:type", Object)
], Aliment.prototype, "cholesterolMg", void 0);
__decorate([
    column({ columnName: 'salt_g' }),
    __metadata("design:type", Object)
], Aliment.prototype, "saltG", void 0);
__decorate([
    column({ columnName: 'calcium_mg' }),
    __metadata("design:type", Object)
], Aliment.prototype, "calciumMg", void 0);
__decorate([
    column({ columnName: 'chloride_mg' }),
    __metadata("design:type", Object)
], Aliment.prototype, "chlorideMg", void 0);
__decorate([
    column({ columnName: 'copper_mg' }),
    __metadata("design:type", Object)
], Aliment.prototype, "copperMg", void 0);
__decorate([
    column({ columnName: 'iron_mg' }),
    __metadata("design:type", Object)
], Aliment.prototype, "ironMg", void 0);
__decorate([
    column({ columnName: 'iodine_microg' }),
    __metadata("design:type", Object)
], Aliment.prototype, "iodineMicrog", void 0);
__decorate([
    column({ columnName: 'magnesium_mg' }),
    __metadata("design:type", Object)
], Aliment.prototype, "magnesiumMg", void 0);
__decorate([
    column({ columnName: 'manganese_mg' }),
    __metadata("design:type", Object)
], Aliment.prototype, "manganeseMg", void 0);
__decorate([
    column({ columnName: 'phosphorus_mg' }),
    __metadata("design:type", Object)
], Aliment.prototype, "phosphorusMg", void 0);
__decorate([
    column({ columnName: 'potassium_mg' }),
    __metadata("design:type", Object)
], Aliment.prototype, "potassiumMg", void 0);
__decorate([
    column({ columnName: 'selenium_microg' }),
    __metadata("design:type", Object)
], Aliment.prototype, "seleniumMicrog", void 0);
__decorate([
    column({ columnName: 'sodium_mg' }),
    __metadata("design:type", Object)
], Aliment.prototype, "sodiumMg", void 0);
__decorate([
    column({ columnName: 'zinc_mg' }),
    __metadata("design:type", Object)
], Aliment.prototype, "zincMg", void 0);
__decorate([
    column({ columnName: 'vitamin_D_microg' }),
    __metadata("design:type", Object)
], Aliment.prototype, "vitaminDMicrog", void 0);
__decorate([
    column({ columnName: 'vitamin_E_mg' }),
    __metadata("design:type", Object)
], Aliment.prototype, "vitaminEMg", void 0);
__decorate([
    column({ columnName: 'vitamin_C_mg' }),
    __metadata("design:type", Object)
], Aliment.prototype, "vitaminCMg", void 0);
__decorate([
    column({ columnName: 'vitamin_B1_mg' }),
    __metadata("design:type", Object)
], Aliment.prototype, "vitaminB1Mg", void 0);
__decorate([
    column({ columnName: 'vitamin_B2_mg' }),
    __metadata("design:type", Object)
], Aliment.prototype, "vitaminB2Mg", void 0);
__decorate([
    column({ columnName: 'vitamin_B3_mg' }),
    __metadata("design:type", Object)
], Aliment.prototype, "vitaminB3Mg", void 0);
__decorate([
    column({ columnName: 'vitamin_B5_mg' }),
    __metadata("design:type", Object)
], Aliment.prototype, "vitaminB5Mg", void 0);
__decorate([
    column({ columnName: 'vitamin_B6_mg' }),
    __metadata("design:type", Object)
], Aliment.prototype, "vitaminB6Mg", void 0);
__decorate([
    column({ columnName: 'vitamin_B9_microg' }),
    __metadata("design:type", Object)
], Aliment.prototype, "vitaminB9Microg", void 0);
__decorate([
    column({ columnName: 'vitamin_b12_microg' }),
    __metadata("design:type", Object)
], Aliment.prototype, "vitaminB12Microg", void 0);
__decorate([
    column({ columnName: 'barcode' }),
    __metadata("design:type", Object)
], Aliment.prototype, "barcode", void 0);
__decorate([
    column({ columnName: 'position' }),
    __metadata("design:type", Object)
], Aliment.prototype, "position", void 0);
__decorate([
    column({ columnName: 'popularity_score' }),
    __metadata("design:type", Object)
], Aliment.prototype, "popularityScore", void 0);
__decorate([
    column({ columnName: 'subgroup_id' }),
    __metadata("design:type", Object)
], Aliment.prototype, "subgroupId", void 0);
__decorate([
    belongsTo(() => AlimentSubgroup),
    __metadata("design:type", Object)
], Aliment.prototype, "subgroup", void 0);
__decorate([
    column({ columnName: 'added_by_id' }),
    __metadata("design:type", Object)
], Aliment.prototype, "addedById", void 0);
__decorate([
    belongsTo(() => Athlete),
    __metadata("design:type", Object)
], Aliment.prototype, "addedBy", void 0);
__decorate([
    hasMany(() => NutritionFavorite, { foreignKey: 'foodId' }),
    __metadata("design:type", Object)
], Aliment.prototype, "nutritionFavorites", void 0);
//# sourceMappingURL=aliment.js.map