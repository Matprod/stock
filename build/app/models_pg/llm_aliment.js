var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
import { BaseModel, column } from '@adonisjs/lucid/orm';
const consumeNumber = (value) => {
    if (value === null || value === undefined)
        return null;
    return Number(value);
};
export default class LlmAliment extends BaseModel {
}
__decorate([
    column({ isPrimary: true }),
    __metadata("design:type", String)
], LlmAliment.prototype, "id", void 0);
__decorate([
    column(),
    __metadata("design:type", String)
], LlmAliment.prototype, "name", void 0);
__decorate([
    column({ consume: consumeNumber }),
    __metadata("design:type", Object)
], LlmAliment.prototype, "energyKcal", void 0);
__decorate([
    column({ consume: consumeNumber }),
    __metadata("design:type", Object)
], LlmAliment.prototype, "waterG", void 0);
__decorate([
    column({ consume: consumeNumber }),
    __metadata("design:type", Object)
], LlmAliment.prototype, "proteinsG", void 0);
__decorate([
    column({ consume: consumeNumber }),
    __metadata("design:type", Object)
], LlmAliment.prototype, "carbohydrateG", void 0);
__decorate([
    column({ consume: consumeNumber }),
    __metadata("design:type", Object)
], LlmAliment.prototype, "fatG", void 0);
__decorate([
    column({ consume: consumeNumber }),
    __metadata("design:type", Object)
], LlmAliment.prototype, "sugarsG", void 0);
__decorate([
    column({ consume: consumeNumber }),
    __metadata("design:type", Object)
], LlmAliment.prototype, "fibresG", void 0);
__decorate([
    column({ consume: consumeNumber }),
    __metadata("design:type", Object)
], LlmAliment.prototype, "starchG", void 0);
__decorate([
    column({ consume: consumeNumber }),
    __metadata("design:type", Object)
], LlmAliment.prototype, "glutenG", void 0);
__decorate([
    column({ consume: consumeNumber }),
    __metadata("design:type", Object)
], LlmAliment.prototype, "alcoholG", void 0);
__decorate([
    column({ columnName: 'fa_saturated_g', consume: consumeNumber }),
    __metadata("design:type", Object)
], LlmAliment.prototype, "faSaturatedG", void 0);
__decorate([
    column({ columnName: 'fa_mono_g', consume: consumeNumber }),
    __metadata("design:type", Object)
], LlmAliment.prototype, "faMonoG", void 0);
__decorate([
    column({ columnName: 'fa_poly_g', consume: consumeNumber }),
    __metadata("design:type", Object)
], LlmAliment.prototype, "faPolyG", void 0);
__decorate([
    column({ columnName: 'fa_181_g', consume: consumeNumber }),
    __metadata("design:type", Object)
], LlmAliment.prototype, "fa181G", void 0);
__decorate([
    column({ columnName: 'fa_182_g', consume: consumeNumber }),
    __metadata("design:type", Object)
], LlmAliment.prototype, "fa182G", void 0);
__decorate([
    column({ consume: consumeNumber }),
    __metadata("design:type", Object)
], LlmAliment.prototype, "cholesterolMg", void 0);
__decorate([
    column({ consume: consumeNumber }),
    __metadata("design:type", Object)
], LlmAliment.prototype, "saltG", void 0);
__decorate([
    column({ consume: consumeNumber }),
    __metadata("design:type", Object)
], LlmAliment.prototype, "calciumMg", void 0);
__decorate([
    column({ consume: consumeNumber }),
    __metadata("design:type", Object)
], LlmAliment.prototype, "chlorideMg", void 0);
__decorate([
    column({ consume: consumeNumber }),
    __metadata("design:type", Object)
], LlmAliment.prototype, "copperMg", void 0);
__decorate([
    column({ consume: consumeNumber }),
    __metadata("design:type", Object)
], LlmAliment.prototype, "ironMg", void 0);
__decorate([
    column({ consume: consumeNumber }),
    __metadata("design:type", Object)
], LlmAliment.prototype, "iodineMicrog", void 0);
__decorate([
    column({ consume: consumeNumber }),
    __metadata("design:type", Object)
], LlmAliment.prototype, "magnesiumMg", void 0);
__decorate([
    column({ consume: consumeNumber }),
    __metadata("design:type", Object)
], LlmAliment.prototype, "manganeseMg", void 0);
__decorate([
    column({ consume: consumeNumber }),
    __metadata("design:type", Object)
], LlmAliment.prototype, "phosphorusMg", void 0);
__decorate([
    column({ consume: consumeNumber }),
    __metadata("design:type", Object)
], LlmAliment.prototype, "potassiumMg", void 0);
__decorate([
    column({ consume: consumeNumber }),
    __metadata("design:type", Object)
], LlmAliment.prototype, "seleniumMicrog", void 0);
__decorate([
    column({ consume: consumeNumber }),
    __metadata("design:type", Object)
], LlmAliment.prototype, "sodiumMg", void 0);
__decorate([
    column({ consume: consumeNumber }),
    __metadata("design:type", Object)
], LlmAliment.prototype, "zincMg", void 0);
__decorate([
    column({ columnName: 'vitamin_d_microg', consume: consumeNumber }),
    __metadata("design:type", Object)
], LlmAliment.prototype, "vitaminDMicrog", void 0);
__decorate([
    column({ columnName: 'vitamin_e_mg', consume: consumeNumber }),
    __metadata("design:type", Object)
], LlmAliment.prototype, "vitaminEMg", void 0);
__decorate([
    column({ columnName: 'vitamin_c_mg', consume: consumeNumber }),
    __metadata("design:type", Object)
], LlmAliment.prototype, "vitaminCMg", void 0);
__decorate([
    column({ columnName: 'vitamin_b1_mg', consume: consumeNumber }),
    __metadata("design:type", Object)
], LlmAliment.prototype, "vitaminB1Mg", void 0);
__decorate([
    column({ columnName: 'vitamin_b2_mg', consume: consumeNumber }),
    __metadata("design:type", Object)
], LlmAliment.prototype, "vitaminB2Mg", void 0);
__decorate([
    column({ columnName: 'vitamin_b3_mg', consume: consumeNumber }),
    __metadata("design:type", Object)
], LlmAliment.prototype, "vitaminB3Mg", void 0);
__decorate([
    column({ columnName: 'vitamin_b5_mg', consume: consumeNumber }),
    __metadata("design:type", Object)
], LlmAliment.prototype, "vitaminB5Mg", void 0);
__decorate([
    column({ columnName: 'vitamin_b6_mg', consume: consumeNumber }),
    __metadata("design:type", Object)
], LlmAliment.prototype, "vitaminB6Mg", void 0);
__decorate([
    column({ columnName: 'vitamin_b9_microg', consume: consumeNumber }),
    __metadata("design:type", Object)
], LlmAliment.prototype, "vitaminB9Microg", void 0);
__decorate([
    column({ columnName: 'vitamin_b12_microg', consume: consumeNumber }),
    __metadata("design:type", Object)
], LlmAliment.prototype, "vitaminB12Microg", void 0);
__decorate([
    column({ consume: consumeNumber }),
    __metadata("design:type", Object)
], LlmAliment.prototype, "fructoseG", void 0);
__decorate([
    column({ consume: consumeNumber }),
    __metadata("design:type", Object)
], LlmAliment.prototype, "glucoseG", void 0);
__decorate([
    column({ consume: consumeNumber }),
    __metadata("design:type", Object)
], LlmAliment.prototype, "lactoseG", void 0);
__decorate([
    column({ consume: consumeNumber }),
    __metadata("design:type", Object)
], LlmAliment.prototype, "maltoseG", void 0);
__decorate([
    column({ consume: consumeNumber }),
    __metadata("design:type", Object)
], LlmAliment.prototype, "sucroseG", void 0);
__decorate([
    column({ consume: consumeNumber }),
    __metadata("design:type", Object)
], LlmAliment.prototype, "portion", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], LlmAliment.prototype, "portionUnit", void 0);
__decorate([
    column.dateTime({ autoCreate: true }),
    __metadata("design:type", Function)
], LlmAliment.prototype, "createdAt", void 0);
__decorate([
    column.dateTime({ autoCreate: true, autoUpdate: true }),
    __metadata("design:type", Function)
], LlmAliment.prototype, "updatedAt", void 0);
//# sourceMappingURL=llm_aliment.js.map