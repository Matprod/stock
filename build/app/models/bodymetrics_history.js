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
import Athlete from '#models/athlete';
import Day from '#models/day';
export default class BodymetricsHistory extends BaseModel {
}
__decorate([
    column({ isPrimary: true }),
    __metadata("design:type", Number)
], BodymetricsHistory.prototype, "id", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], BodymetricsHistory.prototype, "weight", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], BodymetricsHistory.prototype, "fatPercentage", void 0);
__decorate([
    belongsTo(() => Athlete),
    __metadata("design:type", Object)
], BodymetricsHistory.prototype, "athlete", void 0);
__decorate([
    column(),
    __metadata("design:type", Number)
], BodymetricsHistory.prototype, "athleteId", void 0);
__decorate([
    column(),
    __metadata("design:type", Number)
], BodymetricsHistory.prototype, "dayId", void 0);
__decorate([
    belongsTo(() => Day),
    __metadata("design:type", Object)
], BodymetricsHistory.prototype, "day", void 0);
__decorate([
    column.dateTime({ autoCreate: true }),
    __metadata("design:type", DateTime)
], BodymetricsHistory.prototype, "createdAt", void 0);
__decorate([
    column.dateTime({ autoCreate: true, autoUpdate: true }),
    __metadata("design:type", DateTime)
], BodymetricsHistory.prototype, "updatedAt", void 0);
//# sourceMappingURL=bodymetrics_history.js.map