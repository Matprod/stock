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
import SportActivity from '#models_pg/sport_activity';
import SportActivityMetric from '#models_pg/sport_activity_metric';
export default class SportActivityMetricValue extends BaseModel {
    static table = 'sport_activity_metric_values';
}
__decorate([
    column({ isPrimary: true }),
    __metadata("design:type", String)
], SportActivityMetricValue.prototype, "id", void 0);
__decorate([
    column(),
    __metadata("design:type", String)
], SportActivityMetricValue.prototype, "sportActivityId", void 0);
__decorate([
    column(),
    __metadata("design:type", String)
], SportActivityMetricValue.prototype, "metricId", void 0);
__decorate([
    column(),
    __metadata("design:type", String)
], SportActivityMetricValue.prototype, "source", void 0);
__decorate([
    column(),
    __metadata("design:type", String)
], SportActivityMetricValue.prototype, "value", void 0);
__decorate([
    belongsTo(() => SportActivity),
    __metadata("design:type", Object)
], SportActivityMetricValue.prototype, "sportActivity", void 0);
__decorate([
    belongsTo(() => SportActivityMetric, {
        foreignKey: 'metricId',
    }),
    __metadata("design:type", Object)
], SportActivityMetricValue.prototype, "metric", void 0);
__decorate([
    column.dateTime({ autoCreate: true }),
    __metadata("design:type", DateTime)
], SportActivityMetricValue.prototype, "createdAt", void 0);
__decorate([
    column.dateTime({ autoCreate: true, autoUpdate: true }),
    __metadata("design:type", DateTime)
], SportActivityMetricValue.prototype, "updatedAt", void 0);
//# sourceMappingURL=sport_activity_metric_value.js.map