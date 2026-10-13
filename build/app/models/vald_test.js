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
import Day from '#models/day';
import ValdTrial from '#models/vald_trial';
export default class ValdTest extends BaseModel {
    static table = 'vald_tests';
}
__decorate([
    column({ isPrimary: true }),
    __metadata("design:type", Number)
], ValdTest.prototype, "id", void 0);
__decorate([
    column(),
    __metadata("design:type", Number)
], ValdTest.prototype, "athleteDayId", void 0);
__decorate([
    column(),
    __metadata("design:type", String)
], ValdTest.prototype, "testType", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], ValdTest.prototype, "value", void 0);
__decorate([
    belongsTo(() => Day, { foreignKey: 'athleteDayId' }),
    __metadata("design:type", Object)
], ValdTest.prototype, "athleteDay", void 0);
__decorate([
    hasMany(() => ValdTrial, { foreignKey: 'valdTestId' }),
    __metadata("design:type", Object)
], ValdTest.prototype, "trials", void 0);
//# sourceMappingURL=vald_test.js.map