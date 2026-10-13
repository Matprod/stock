var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
import { BaseModel, column, belongsTo, hasMany } from '@adonisjs/lucid/orm';
import Athlete from '#models_pg/athlete';
import NutritionFavoriteFood from '#models_pg/favorite_aliments';
export default class Aliment extends BaseModel {
}
__decorate([
    column({ isPrimary: true }),
    __metadata("design:type", String)
], Aliment.prototype, "id", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], Aliment.prototype, "alimCode", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], Aliment.prototype, "name", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], Aliment.prototype, "portion", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], Aliment.prototype, "portionUnit", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], Aliment.prototype, "referenceDatabase", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], Aliment.prototype, "modificated", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], Aliment.prototype, "energyKcal", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], Aliment.prototype, "waterG", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], Aliment.prototype, "proteinsG", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], Aliment.prototype, "carbohydrateG", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], Aliment.prototype, "fatG", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], Aliment.prototype, "glutenG", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], Aliment.prototype, "sugarsG", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], Aliment.prototype, "fructoseG", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], Aliment.prototype, "galactoseG", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], Aliment.prototype, "glucoseG", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], Aliment.prototype, "lactoseG", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], Aliment.prototype, "maltoseG", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], Aliment.prototype, "sucroseG", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], Aliment.prototype, "starchG", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], Aliment.prototype, "fibresG", void 0);
__decorate([
    column(),
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
    column(),
    __metadata("design:type", Object)
], Aliment.prototype, "cholesterolMg", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], Aliment.prototype, "saltG", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], Aliment.prototype, "calciumMg", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], Aliment.prototype, "chlorideMg", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], Aliment.prototype, "copperMg", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], Aliment.prototype, "ironMg", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], Aliment.prototype, "iodineMicrog", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], Aliment.prototype, "magnesiumMg", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], Aliment.prototype, "manganeseMg", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], Aliment.prototype, "phosphorusMg", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], Aliment.prototype, "potassiumMg", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], Aliment.prototype, "seleniumMicrog", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], Aliment.prototype, "sodiumMg", void 0);
__decorate([
    column(),
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
    column({ columnName: 'vitamin_B12_microg' }),
    __metadata("design:type", Object)
], Aliment.prototype, "vitaminB12Microg", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], Aliment.prototype, "barcode", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], Aliment.prototype, "position", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], Aliment.prototype, "popularityScore", void 0);
__decorate([
    column({ columnName: 'athlete_id' }),
    __metadata("design:type", Object)
], Aliment.prototype, "addedById", void 0);
__decorate([
    belongsTo(() => Athlete, { foreignKey: 'addedById' }),
    __metadata("design:type", Object)
], Aliment.prototype, "addedBy", void 0);
__decorate([
    hasMany(() => NutritionFavoriteFood, { foreignKey: 'alimentId' }),
    __metadata("design:type", Object)
], Aliment.prototype, "nutritionFavorites", void 0);
//# sourceMappingURL=aliment.js.map