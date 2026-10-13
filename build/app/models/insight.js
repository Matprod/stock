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
import { BaseModel, column, hasMany, manyToMany } from '@adonisjs/lucid/orm';
import FeatureImportance from '#models/feature_importance';
import Club from '#models/club';
export default class Insight extends BaseModel {
}
__decorate([
    column({ isPrimary: true }),
    __metadata("design:type", Number)
], Insight.prototype, "id", void 0);
__decorate([
    column(),
    __metadata("design:type", String)
], Insight.prototype, "variableName", void 0);
__decorate([
    column(),
    __metadata("design:type", String)
], Insight.prototype, "name", void 0);
__decorate([
    column(),
    __metadata("design:type", String)
], Insight.prototype, "description", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], Insight.prototype, "tresholdLow", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], Insight.prototype, "tresholdTooLow", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], Insight.prototype, "tresholdHigh", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], Insight.prototype, "tresholdTooHigh", void 0);
__decorate([
    column(),
    __metadata("design:type", String)
], Insight.prototype, "tresholdType", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], Insight.prototype, "maximum", void 0);
__decorate([
    column(),
    __metadata("design:type", Boolean)
], Insight.prototype, "canTooHigh", void 0);
__decorate([
    column(),
    __metadata("design:type", Boolean)
], Insight.prototype, "canTooLow", void 0);
__decorate([
    column.dateTime({ autoCreate: true }),
    __metadata("design:type", DateTime)
], Insight.prototype, "createdAt", void 0);
__decorate([
    column.dateTime({ autoCreate: true, autoUpdate: true }),
    __metadata("design:type", DateTime)
], Insight.prototype, "updatedAt", void 0);
__decorate([
    hasMany(() => FeatureImportance),
    __metadata("design:type", Object)
], Insight.prototype, "featureImportances", void 0);
__decorate([
    manyToMany(() => Club, {
        pivotTable: 'club_insights',
    }),
    __metadata("design:type", Object)
], Insight.prototype, "clubs", void 0);
//# sourceMappingURL=insight.js.map