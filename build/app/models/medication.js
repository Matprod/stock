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
import { BaseModel, belongsTo, column, hasMany } from '@adonisjs/lucid/orm';
import Day from '#models/day';
import FoodSupplement from '#models/food_supplement';
export default class Medication extends BaseModel {
    static table = 'health_medication';
}
__decorate([
    column({ isPrimary: true }),
    __metadata("design:type", Number)
], Medication.prototype, "id", void 0);
__decorate([
    column(),
    __metadata("design:type", Number)
], Medication.prototype, "athleteDayId", void 0);
__decorate([
    belongsTo(() => Day, {
        foreignKey: 'athleteDayId',
    }),
    __metadata("design:type", Object)
], Medication.prototype, "day", void 0);
__decorate([
    column.dateTime({ autoCreate: true }),
    __metadata("design:type", DateTime)
], Medication.prototype, "dateAdded", void 0);
__decorate([
    column.dateTime({ autoCreate: true, autoUpdate: true }),
    __metadata("design:type", DateTime)
], Medication.prototype, "dateUpdated", void 0);
__decorate([
    hasMany(() => FoodSupplement, {
        foreignKey: 'medicationId',
    }),
    __metadata("design:type", Object)
], Medication.prototype, "foodSupplements", void 0);
//# sourceMappingURL=medication.js.map