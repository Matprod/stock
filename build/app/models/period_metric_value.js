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
import PeriodMetric from '#models/period_metric';
import Period from '#models/period';
export default class PeriodMetricValue extends BaseModel {
}
__decorate([
    column({ isPrimary: true }),
    __metadata("design:type", Number)
], PeriodMetricValue.prototype, "id", void 0);
__decorate([
    column(),
    __metadata("design:type", Number)
], PeriodMetricValue.prototype, "periodId", void 0);
__decorate([
    column(),
    __metadata("design:type", Number)
], PeriodMetricValue.prototype, "metricId", void 0);
__decorate([
    column(),
    __metadata("design:type", String)
], PeriodMetricValue.prototype, "value", void 0);
__decorate([
    belongsTo(() => Period, {
        foreignKey: 'periodId',
        localKey: 'id',
    }),
    __metadata("design:type", Object)
], PeriodMetricValue.prototype, "period", void 0);
__decorate([
    belongsTo(() => PeriodMetric, {
        foreignKey: 'metricId',
        localKey: 'id',
    }),
    __metadata("design:type", Object)
], PeriodMetricValue.prototype, "metric", void 0);
__decorate([
    column.dateTime({ autoCreate: true }),
    __metadata("design:type", DateTime)
], PeriodMetricValue.prototype, "createdAt", void 0);
__decorate([
    column.dateTime({ autoCreate: true, autoUpdate: true }),
    __metadata("design:type", DateTime)
], PeriodMetricValue.prototype, "updatedAt", void 0);
//# sourceMappingURL=period_metric_value.js.map