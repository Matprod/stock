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
import { BaseModel, column, belongsTo, hasMany, hasOne, computed } from '@adonisjs/lucid/orm';
import Athlete from '#models_pg/athlete';
import SportActivity from '#models_pg/sport_activity';
import Sleep from '#models_pg/sleep';
import Health from '#models_pg/health_rating';
import Nutrition from '#models_pg/nutrition';
import FeatureImportance from '#models_pg/feature_importance';
import BodymetricsHistory from '#models_pg/bodymetrics_history';
import DayMetricValue from '#models_pg/day_metric_value';
export default class Day extends BaseModel {
    get weight() {
        if (this.bodymetricsHistories && this.bodymetricsHistories.length > 0) {
            return this.bodymetricsHistories[0].weight;
        }
        return null;
    }
}
__decorate([
    column({ isPrimary: true }),
    __metadata("design:type", String)
], Day.prototype, "id", void 0);
__decorate([
    column(),
    __metadata("design:type", String)
], Day.prototype, "athleteId", void 0);
__decorate([
    column.date(),
    __metadata("design:type", DateTime)
], Day.prototype, "dateOfDay", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], Day.prototype, "performanceScore", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], Day.prototype, "performanceScoreTest", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], Day.prototype, "injuryRiskScore", void 0);
__decorate([
    belongsTo(() => Athlete),
    __metadata("design:type", Object)
], Day.prototype, "athlete", void 0);
__decorate([
    hasMany(() => SportActivity),
    __metadata("design:type", Object)
], Day.prototype, "sportActivities", void 0);
__decorate([
    hasMany(() => Sleep),
    __metadata("design:type", Object)
], Day.prototype, "sleeps", void 0);
__decorate([
    hasOne(() => Health),
    __metadata("design:type", Object)
], Day.prototype, "health", void 0);
__decorate([
    hasMany(() => Nutrition),
    __metadata("design:type", Object)
], Day.prototype, "nutrition", void 0);
__decorate([
    hasMany(() => FeatureImportance),
    __metadata("design:type", Object)
], Day.prototype, "featureImportances", void 0);
__decorate([
    hasMany(() => BodymetricsHistory),
    __metadata("design:type", Object)
], Day.prototype, "bodymetricsHistories", void 0);
__decorate([
    hasMany(() => DayMetricValue),
    __metadata("design:type", Object)
], Day.prototype, "metricValues", void 0);
__decorate([
    computed(),
    __metadata("design:type", Object),
    __metadata("design:paramtypes", [])
], Day.prototype, "weight", null);
//# sourceMappingURL=day.js.map