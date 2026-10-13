var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm';
import ValdTest from '#models/vald_test';
import { DateTime } from 'luxon';
export default class ValdTrial extends BaseModel {
    static table = 'vald_trials';
}
__decorate([
    column({ isPrimary: true }),
    __metadata("design:type", Number)
], ValdTrial.prototype, "id", void 0);
__decorate([
    column(),
    __metadata("design:type", Number)
], ValdTrial.prototype, "valdTestId", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], ValdTrial.prototype, "trialJumpHeight", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], ValdTrial.prototype, "trialRsiModified", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], ValdTrial.prototype, "trialPeakTakeoffPower", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], ValdTrial.prototype, "trialConcentricRfd", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], ValdTrial.prototype, "trialPeakLandingForce", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], ValdTrial.prototype, "trialTimeToStabilisation", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], ValdTrial.prototype, "trialRsi", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], ValdTrial.prototype, "trialEccentricBrakingRfd", void 0);
__decorate([
    column.dateTime({ autoCreate: true }),
    __metadata("design:type", DateTime)
], ValdTrial.prototype, "createdAt", void 0);
__decorate([
    column.dateTime({ autoCreate: true, autoUpdate: true }),
    __metadata("design:type", DateTime)
], ValdTrial.prototype, "updatedAt", void 0);
__decorate([
    belongsTo(() => ValdTest, { foreignKey: 'valdTestId' }),
    __metadata("design:type", Object)
], ValdTrial.prototype, "valdTest", void 0);
//# sourceMappingURL=vald_trial.js.map