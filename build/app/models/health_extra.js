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
import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm';
import Day from '#models/day';
export default class HealthExtra extends BaseModel {
    static table = 'health_extra';
}
__decorate([
    column({ isPrimary: true }),
    __metadata("design:type", Number)
], HealthExtra.prototype, "id", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], HealthExtra.prototype, "numberOfCigarettes", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], HealthExtra.prototype, "pma", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], HealthExtra.prototype, "vma", void 0);
__decorate([
    column({ columnName: 'vo2_max' }),
    __metadata("design:type", Object)
], HealthExtra.prototype, "vo2Max", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], HealthExtra.prototype, "weight", void 0);
__decorate([
    column.dateTime(),
    __metadata("design:type", Object)
], HealthExtra.prototype, "dateAdded", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], HealthExtra.prototype, "criticalPowerWatts", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], HealthExtra.prototype, "criticalSpeedKmPerH", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], HealthExtra.prototype, "fcMax", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], HealthExtra.prototype, "fcMin", void 0);
__decorate([
    column.dateTime(),
    __metadata("design:type", DateTime)
], HealthExtra.prototype, "dateUpdated", void 0);
__decorate([
    column(),
    __metadata("design:type", Number)
], HealthExtra.prototype, "athleteDayId", void 0);
__decorate([
    belongsTo(() => Day, { foreignKey: 'athleteDayId' }),
    __metadata("design:type", Object)
], HealthExtra.prototype, "day", void 0);
//# sourceMappingURL=health_extra.js.map