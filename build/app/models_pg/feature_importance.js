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
import Insight from '#models_pg/insight';
import Day from '#models_pg/day';
export default class FeatureImportance extends BaseModel {
}
__decorate([
    column({ isPrimary: true }),
    __metadata("design:type", String)
], FeatureImportance.prototype, "id", void 0);
__decorate([
    column(),
    __metadata("design:type", Number)
], FeatureImportance.prototype, "value", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], FeatureImportance.prototype, "optimal", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], FeatureImportance.prototype, "shapValue", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], FeatureImportance.prototype, "contribPct", void 0);
__decorate([
    column(),
    __metadata("design:type", String)
], FeatureImportance.prototype, "type", void 0);
__decorate([
    column(),
    __metadata("design:type", String)
], FeatureImportance.prototype, "category", void 0);
__decorate([
    column(),
    __metadata("design:type", String)
], FeatureImportance.prototype, "insightId", void 0);
__decorate([
    belongsTo(() => Insight),
    __metadata("design:type", Object)
], FeatureImportance.prototype, "insight", void 0);
__decorate([
    column(),
    __metadata("design:type", String)
], FeatureImportance.prototype, "dayId", void 0);
__decorate([
    belongsTo(() => Day),
    __metadata("design:type", Object)
], FeatureImportance.prototype, "day", void 0);
__decorate([
    column.dateTime({ autoCreate: true }),
    __metadata("design:type", DateTime)
], FeatureImportance.prototype, "createdAt", void 0);
__decorate([
    column.dateTime({ autoCreate: true, autoUpdate: true }),
    __metadata("design:type", DateTime)
], FeatureImportance.prototype, "updatedAt", void 0);
//# sourceMappingURL=feature_importance.js.map