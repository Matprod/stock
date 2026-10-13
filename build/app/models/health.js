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
import Day from '#models/day';
import HealthPain from '#models/health_pain';
import HealthRating from '#models/health_rating';
import Travel from '#models/travel';
import HealthMetricValue from '#models/health_metric_value';
export default class Health extends BaseModel {
    static table = 'health_health';
}
__decorate([
    column({ isPrimary: true }),
    __metadata("design:type", Number)
], Health.prototype, "id", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], Health.prototype, "energyRating", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], Health.prototype, "bodySorenessRating", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], Health.prototype, "moodRating", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], Health.prototype, "stressRating", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], Health.prototype, "period", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], Health.prototype, "numberOfCigarettes", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], Health.prototype, "averagedHeartRate", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], Health.prototype, "weight", void 0);
__decorate([
    column.dateTime(),
    __metadata("design:type", Object)
], Health.prototype, "dateAdded", void 0);
__decorate([
    column.dateTime(),
    __metadata("design:type", Object)
], Health.prototype, "dateUpdated", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], Health.prototype, "heartRateVariability", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], Health.prototype, "restingHeartRate", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], Health.prototype, "travel", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], Health.prototype, "recoveryScore", void 0);
__decorate([
    column(),
    __metadata("design:type", Number)
], Health.prototype, "athleteDayId", void 0);
__decorate([
    belongsTo(() => Day, {
        foreignKey: 'athleteDayId',
    }),
    __metadata("design:type", Object)
], Health.prototype, "day", void 0);
__decorate([
    hasMany(() => HealthPain),
    __metadata("design:type", Object)
], Health.prototype, "pains", void 0);
__decorate([
    hasMany(() => HealthRating, {
        foreignKey: 'healthId',
    }),
    __metadata("design:type", Object)
], Health.prototype, "ratings", void 0);
__decorate([
    hasMany(() => Travel, {
        foreignKey: 'healthId',
    }),
    __metadata("design:type", Object)
], Health.prototype, "travels", void 0);
__decorate([
    hasMany(() => HealthMetricValue),
    __metadata("design:type", Object)
], Health.prototype, "metricValues", void 0);
//# sourceMappingURL=health.js.map