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
import { BaseModel, belongsTo, column } from '@adonisjs/lucid/orm';
import SupplementsName from '#models/health_food_supplement_name';
import Medication from '#models/medication';
export default class FoodSupplement extends BaseModel {
    static table = 'health_foodsupplement';
}
__decorate([
    column({ isPrimary: true }),
    __metadata("design:type", Number)
], FoodSupplement.prototype, "id", void 0);
__decorate([
    column(),
    __metadata("design:type", Number)
], FoodSupplement.prototype, "quantity", void 0);
__decorate([
    column(),
    __metadata("design:type", Number)
], FoodSupplement.prototype, "suppNameId", void 0);
__decorate([
    belongsTo(() => SupplementsName, {
        foreignKey: 'suppNameId',
    }),
    __metadata("design:type", Object)
], FoodSupplement.prototype, "suppName", void 0);
__decorate([
    column(),
    __metadata("design:type", Number)
], FoodSupplement.prototype, "medicationId", void 0);
__decorate([
    belongsTo(() => Medication, {
        foreignKey: 'medicationId',
    }),
    __metadata("design:type", Object)
], FoodSupplement.prototype, "medication", void 0);
__decorate([
    column.dateTime({ autoCreate: true, autoUpdate: true }),
    __metadata("design:type", DateTime)
], FoodSupplement.prototype, "dateUpdated", void 0);
//# sourceMappingURL=food_supplement.js.map