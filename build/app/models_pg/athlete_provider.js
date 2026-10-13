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
import Athlete from '#models_pg/athlete';
export default class AthleteProvider extends BaseModel {
}
__decorate([
    column({ isPrimary: true }),
    __metadata("design:type", String)
], AthleteProvider.prototype, "id", void 0);
__decorate([
    column(),
    __metadata("design:type", String)
], AthleteProvider.prototype, "provider", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], AthleteProvider.prototype, "providerAthleteId", void 0);
__decorate([
    column(),
    __metadata("design:type", String)
], AthleteProvider.prototype, "athleteId", void 0);
__decorate([
    column({ serializeAs: null }),
    __metadata("design:type", Object)
], AthleteProvider.prototype, "accessToken", void 0);
__decorate([
    column({ serializeAs: null }),
    __metadata("design:type", Object)
], AthleteProvider.prototype, "accessTokenSecret", void 0);
__decorate([
    column({ serializeAs: null }),
    __metadata("design:type", Object)
], AthleteProvider.prototype, "refreshToken", void 0);
__decorate([
    column.dateTime(),
    __metadata("design:type", Object)
], AthleteProvider.prototype, "tokenExpiresAt", void 0);
__decorate([
    column.dateTime({ autoCreate: true }),
    __metadata("design:type", DateTime)
], AthleteProvider.prototype, "createdAt", void 0);
__decorate([
    column.dateTime({ autoCreate: true, autoUpdate: true }),
    __metadata("design:type", DateTime)
], AthleteProvider.prototype, "updatedAt", void 0);
__decorate([
    belongsTo(() => Athlete),
    __metadata("design:type", Object)
], AthleteProvider.prototype, "athlete", void 0);
//# sourceMappingURL=athlete_provider.js.map