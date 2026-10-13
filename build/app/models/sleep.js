var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
import { BaseModel, belongsTo, column, computed, hasMany } from '@adonisjs/lucid/orm';
import Day from '#models/day';
import SleepMetricValue from '#models/sleep_metric_value';
export default class Sleep extends BaseModel {
    static table = 'sleep_sleep';
    get durationHours() {
        return this.totalInBedTimeMilli ? this.totalInBedTimeMilli / (1000 * 60 * 60) : null;
    }
}
__decorate([
    column({ isPrimary: true }),
    __metadata("design:type", Number)
], Sleep.prototype, "id", void 0);
__decorate([
    column.dateTime(),
    __metadata("design:type", Object)
], Sleep.prototype, "bedtimeDate", void 0);
__decorate([
    column.dateTime(),
    __metadata("design:type", Object)
], Sleep.prototype, "wakeUpDate", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], Sleep.prototype, "qualityRating", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], Sleep.prototype, "dataSource", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], Sleep.prototype, "sleepEfficiencyPercentage", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], Sleep.prototype, "sleepConsistencyPercentage", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], Sleep.prototype, "needFromSleepDebtMilli", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], Sleep.prototype, "totalSlowWaveSleepTimeMilli", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], Sleep.prototype, "totalRemSleepTimeMilli", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], Sleep.prototype, "totalInBedTimeMilli", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], Sleep.prototype, "totalAwakeTimeMilli", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], Sleep.prototype, "baselineMili", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], Sleep.prototype, "napAm", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], Sleep.prototype, "napPm", void 0);
__decorate([
    column.dateTime({ autoCreate: true }),
    __metadata("design:type", Object)
], Sleep.prototype, "dateAdded", void 0);
__decorate([
    column.dateTime({ autoCreate: true, autoUpdate: true }),
    __metadata("design:type", Object)
], Sleep.prototype, "dateUpdated", void 0);
__decorate([
    computed(),
    __metadata("design:type", Object),
    __metadata("design:paramtypes", [])
], Sleep.prototype, "durationHours", null);
__decorate([
    column(),
    __metadata("design:type", Number)
], Sleep.prototype, "athleteDayId", void 0);
__decorate([
    belongsTo(() => Day, {
        foreignKey: 'athleteDayId',
    }),
    __metadata("design:type", Object)
], Sleep.prototype, "day", void 0);
__decorate([
    hasMany(() => SleepMetricValue),
    __metadata("design:type", Object)
], Sleep.prototype, "metricValues", void 0);
//# sourceMappingURL=sleep.js.map