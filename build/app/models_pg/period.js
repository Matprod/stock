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
import SportActivity from '#models_pg/sport_activity';
import DataProcessedMetricValue from '#models_pg/data_processed_metric_value';
import PeriodMetricValue from '#models_pg/period_metric_value';
import Serie from '#models_pg/serie';
export default class Period extends BaseModel {
}
__decorate([
    column({ isPrimary: true }),
    __metadata("design:type", String)
], Period.prototype, "id", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], Period.prototype, "providerId", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], Period.prototype, "name", void 0);
__decorate([
    column.dateTime(),
    __metadata("design:type", Object)
], Period.prototype, "startTime", void 0);
__decorate([
    column.dateTime(),
    __metadata("design:type", Object)
], Period.prototype, "endTime", void 0);
__decorate([
    column(),
    __metadata("design:type", String)
], Period.prototype, "sportActivityId", void 0);
__decorate([
    column(),
    __metadata("design:type", Boolean)
], Period.prototype, "needsReview", void 0);
__decorate([
    belongsTo(() => SportActivity),
    __metadata("design:type", Object)
], Period.prototype, "sportActivity", void 0);
__decorate([
    hasMany(() => PeriodMetricValue, { foreignKey: 'periodId' }),
    __metadata("design:type", Object)
], Period.prototype, "metricValues", void 0);
__decorate([
    hasMany(() => DataProcessedMetricValue, { foreignKey: 'periodId' }),
    __metadata("design:type", Object)
], Period.prototype, "dataProcessedMetricValues", void 0);
__decorate([
    hasMany(() => Serie, { foreignKey: 'periodId' }),
    __metadata("design:type", Object)
], Period.prototype, "series", void 0);
__decorate([
    column.dateTime({ autoCreate: true }),
    __metadata("design:type", DateTime)
], Period.prototype, "createdAt", void 0);
__decorate([
    column.dateTime({ autoCreate: true, autoUpdate: true }),
    __metadata("design:type", DateTime)
], Period.prototype, "updatedAt", void 0);
//# sourceMappingURL=period.js.map