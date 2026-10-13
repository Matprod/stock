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
import Day from '#models_pg/day';
import HealthPain from '#models_pg/health_pain';
import Travel from '#models_pg/travel';
import HealthMetricValue from '#models_pg/health_metric_value';
export default class HealthRating extends BaseModel {
}
__decorate([
    column({ isPrimary: true }),
    __metadata("design:type", String)
], HealthRating.prototype, "id", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], HealthRating.prototype, "energyRating", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], HealthRating.prototype, "moodRating", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], HealthRating.prototype, "stressRating", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], HealthRating.prototype, "wellbeingRating", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], HealthRating.prototype, "bodySorenessRating", void 0);
__decorate([
    column(),
    __metadata("design:type", String)
], HealthRating.prototype, "dayId", void 0);
__decorate([
    belongsTo(() => Day),
    __metadata("design:type", Object)
], HealthRating.prototype, "day", void 0);
__decorate([
    hasMany(() => HealthPain, { foreignKey: 'healthId' }),
    __metadata("design:type", Object)
], HealthRating.prototype, "pains", void 0);
__decorate([
    hasMany(() => Travel, { foreignKey: 'healthId' }),
    __metadata("design:type", Object)
], HealthRating.prototype, "travels", void 0);
__decorate([
    hasMany(() => HealthMetricValue, { foreignKey: 'healthId' }),
    __metadata("design:type", Object)
], HealthRating.prototype, "metricValues", void 0);
//# sourceMappingURL=health_rating.js.map