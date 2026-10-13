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
import SleepMetric from '#models/sleep_metric';
import Sleep from '#models/sleep';
export default class SleepMetricValue extends BaseModel {
}
__decorate([
    column({ isPrimary: true }),
    __metadata("design:type", Number)
], SleepMetricValue.prototype, "id", void 0);
__decorate([
    column(),
    __metadata("design:type", Number)
], SleepMetricValue.prototype, "sleepId", void 0);
__decorate([
    column(),
    __metadata("design:type", Number)
], SleepMetricValue.prototype, "metricId", void 0);
__decorate([
    column(),
    __metadata("design:type", String)
], SleepMetricValue.prototype, "value", void 0);
__decorate([
    belongsTo(() => Sleep, {
        foreignKey: 'sleepId',
        localKey: 'id',
    }),
    __metadata("design:type", Object)
], SleepMetricValue.prototype, "sleep", void 0);
__decorate([
    belongsTo(() => SleepMetric, {
        foreignKey: 'metricId',
        localKey: 'id',
    }),
    __metadata("design:type", Object)
], SleepMetricValue.prototype, "metric", void 0);
__decorate([
    column.dateTime({ autoCreate: true }),
    __metadata("design:type", DateTime)
], SleepMetricValue.prototype, "createdAt", void 0);
__decorate([
    column.dateTime({ autoCreate: true, autoUpdate: true }),
    __metadata("design:type", DateTime)
], SleepMetricValue.prototype, "updatedAt", void 0);
//# sourceMappingURL=sleep_metric_value.js.map