var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
import { BaseModel, belongsTo, column } from '@adonisjs/lucid/orm';
import InjuryZone from '#models/injury_zone';
export default class DiscomfortLocation extends BaseModel {
    static table = 'base_paindiscomfortlocation';
    getName(language) {
        if (language === 'en') {
            return this.nameEn || this.nameFr || 'Unknown location';
        }
        return this.nameFr || this.nameEn || 'Unknown location';
    }
}
__decorate([
    column({ isPrimary: true }),
    __metadata("design:type", Number)
], DiscomfortLocation.prototype, "id", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], DiscomfortLocation.prototype, "nameFr", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], DiscomfortLocation.prototype, "nameEn", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], DiscomfortLocation.prototype, "zoneId", void 0);
__decorate([
    belongsTo(() => InjuryZone, {
        foreignKey: 'zoneId',
    }),
    __metadata("design:type", Object)
], DiscomfortLocation.prototype, "zone", void 0);
//# sourceMappingURL=discomfort_location.js.map