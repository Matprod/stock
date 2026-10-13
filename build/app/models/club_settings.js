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
import { BaseModel, beforeSave, belongsTo, column } from '@adonisjs/lucid/orm';
import Club from '#models/club';
export default class ClubSettings extends BaseModel {
    static table = 'club_settings';
    static validateThresholds(row) {
        const validateLevel = (medium, high, label) => {
            if (medium < 0 || medium > 100 || high < 0 || high > 100) {
                throw new Error(`${label} thresholds must be between 0 and 100`);
            }
            if (medium >= high) {
                throw new Error(`${label} medium threshold must be strictly lower than high threshold`);
            }
        };
        validateLevel(row.performanceMedium, row.performanceHigh, 'Performance');
        validateLevel(row.injuryMedium, row.injuryHigh, 'Injury');
        validateLevel(row.availabilityMedium, row.availabilityHigh, 'Availability');
    }
}
__decorate([
    column({ isPrimary: true }),
    __metadata("design:type", Number)
], ClubSettings.prototype, "id", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], ClubSettings.prototype, "clubId", void 0);
__decorate([
    column(),
    __metadata("design:type", Number)
], ClubSettings.prototype, "performanceHigh", void 0);
__decorate([
    column(),
    __metadata("design:type", Number)
], ClubSettings.prototype, "performanceMedium", void 0);
__decorate([
    column(),
    __metadata("design:type", Number)
], ClubSettings.prototype, "injuryHigh", void 0);
__decorate([
    column(),
    __metadata("design:type", Number)
], ClubSettings.prototype, "injuryMedium", void 0);
__decorate([
    column(),
    __metadata("design:type", Number)
], ClubSettings.prototype, "availabilityHigh", void 0);
__decorate([
    column(),
    __metadata("design:type", Number)
], ClubSettings.prototype, "availabilityMedium", void 0);
__decorate([
    belongsTo(() => Club),
    __metadata("design:type", Object)
], ClubSettings.prototype, "club", void 0);
__decorate([
    column.dateTime({ autoCreate: true }),
    __metadata("design:type", DateTime)
], ClubSettings.prototype, "createdAt", void 0);
__decorate([
    column.dateTime({ autoCreate: true, autoUpdate: true }),
    __metadata("design:type", DateTime)
], ClubSettings.prototype, "updatedAt", void 0);
__decorate([
    beforeSave(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [ClubSettings]),
    __metadata("design:returntype", void 0)
], ClubSettings, "validateThresholds", null);
//# sourceMappingURL=club_settings.js.map