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
import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm';
import Health from '#models/health';
import SymptomType from '#models/symptom_type';
export default class HealthRating extends BaseModel {
    static table = 'health_healthrating';
}
__decorate([
    column({ isPrimary: true }),
    __metadata("design:type", Number)
], HealthRating.prototype, "id", void 0);
__decorate([
    column(),
    __metadata("design:type", Number)
], HealthRating.prototype, "rating", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], HealthRating.prototype, "healthId", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], HealthRating.prototype, "typeOfRatingId", void 0);
__decorate([
    column.dateTime(),
    __metadata("design:type", DateTime)
], HealthRating.prototype, "dateUpdated", void 0);
__decorate([
    belongsTo(() => Health),
    __metadata("design:type", Object)
], HealthRating.prototype, "health", void 0);
__decorate([
    belongsTo(() => SymptomType, {
        foreignKey: 'typeOfRatingId'
    }),
    __metadata("design:type", Object)
], HealthRating.prototype, "typeOfRating", void 0);
//# sourceMappingURL=health_rating.js.map