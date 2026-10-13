var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
import { BaseModel, column, belongsTo, hasMany, hasOne, computed } from '@adonisjs/lucid/orm';
import Athlete from '#models/athlete';
import SportActivity from '#models/sport_activity';
import DailyAverage from '#models/daily_average';
import Sleep from '#models/sleep';
import Health from '#models/health';
import Nutrition from '#models/nutrition';
import HealthExtra from '#models/health_extra';
import FeatureImportance from '#models/feature_importance';
import BodymetricsHistory from '#models/bodymetrics_history';
import NutritionMetricValue from '#models/nutrition_metric_value';
import DayMetricValue from '#models/day_metric_value';
import Medication from '#models/medication';
export default class Day extends BaseModel {
    static table = 'base_athleteday';
    get finalScore() {
        return this.performancePrediction ?? this.performanceScore;
    }
    get healthFinalScore() {
        return this.healthScore;
    }
    get activityFinalScore() {
        return this.activityScore;
    }
    get sleepFinalScore() {
        return this.sleepScore;
    }
    get weight() {
        if (this.bodymetricsHistories && this.bodymetricsHistories.length > 0) {
            return this.bodymetricsHistories[0].weight;
        }
        return null;
    }
}
__decorate([
    column({ isPrimary: true }),
    __metadata("design:type", Number)
], Day.prototype, "id", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], Day.prototype, "complete", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], Day.prototype, "performanceScore", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], Day.prototype, "healthScore", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], Day.prototype, "activityScore", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], Day.prototype, "sleepScore", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], Day.prototype, "performancePrediction", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], Day.prototype, "injuryScore", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], Day.prototype, "injuryHealthScore", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], Day.prototype, "injuryActivityScore", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], Day.prototype, "injurySleepScore", void 0);
__decorate([
    column.date(),
    __metadata("design:type", Object)
], Day.prototype, "dateOfDay", void 0);
__decorate([
    column(),
    __metadata("design:type", Number)
], Day.prototype, "athleteId", void 0);
__decorate([
    belongsTo(() => Athlete),
    __metadata("design:type", Object)
], Day.prototype, "athlete", void 0);
__decorate([
    hasMany(() => SportActivity, {
        foreignKey: 'athleteDayId',
    }),
    __metadata("design:type", Object)
], Day.prototype, "sportActivities", void 0);
__decorate([
    hasOne(() => DailyAverage, {
        foreignKey: 'athleteDayId',
    }),
    __metadata("design:type", Object)
], Day.prototype, "dailyAverage", void 0);
__decorate([
    hasMany(() => Sleep, {
        foreignKey: 'athleteDayId',
    }),
    __metadata("design:type", Object)
], Day.prototype, "sleeps", void 0);
__decorate([
    hasOne(() => Health, {
        foreignKey: 'athleteDayId',
    }),
    __metadata("design:type", Object)
], Day.prototype, "health", void 0);
__decorate([
    hasMany(() => Nutrition, {
        foreignKey: 'athleteDayId',
    }),
    __metadata("design:type", Object)
], Day.prototype, "nutrition", void 0);
__decorate([
    hasOne(() => HealthExtra, {
        foreignKey: 'athleteDayId',
    }),
    __metadata("design:type", Object)
], Day.prototype, "healthExtra", void 0);
__decorate([
    hasMany(() => FeatureImportance, {
        foreignKey: 'dayId',
    }),
    __metadata("design:type", Object)
], Day.prototype, "featureImportances", void 0);
__decorate([
    hasMany(() => BodymetricsHistory, { foreignKey: 'dayId' }),
    __metadata("design:type", Object)
], Day.prototype, "bodymetricsHistories", void 0);
__decorate([
    hasMany(() => NutritionMetricValue),
    __metadata("design:type", Object)
], Day.prototype, "nutritionMetricValues", void 0);
__decorate([
    hasMany(() => DayMetricValue, {
        foreignKey: 'athleteDayId',
    }),
    __metadata("design:type", Object)
], Day.prototype, "metricValues", void 0);
__decorate([
    hasMany(() => Medication, {
        foreignKey: 'athleteDayId',
    }),
    __metadata("design:type", Object)
], Day.prototype, "medications", void 0);
__decorate([
    computed(),
    __metadata("design:type", Object),
    __metadata("design:paramtypes", [])
], Day.prototype, "finalScore", null);
__decorate([
    computed(),
    __metadata("design:type", Object),
    __metadata("design:paramtypes", [])
], Day.prototype, "healthFinalScore", null);
__decorate([
    computed(),
    __metadata("design:type", Object),
    __metadata("design:paramtypes", [])
], Day.prototype, "activityFinalScore", null);
__decorate([
    computed(),
    __metadata("design:type", Object),
    __metadata("design:paramtypes", [])
], Day.prototype, "sleepFinalScore", null);
__decorate([
    computed(),
    __metadata("design:type", Object),
    __metadata("design:paramtypes", [])
], Day.prototype, "weight", null);
//# sourceMappingURL=day.js.map