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
import Club from '#models_pg/club';
import { clubProviderSecretColumnOptions } from '#utils/club_provider_encryption';
export default class ClubProvider extends BaseModel {
}
__decorate([
    column({ isPrimary: true }),
    __metadata("design:type", String)
], ClubProvider.prototype, "id", void 0);
__decorate([
    column(),
    __metadata("design:type", String)
], ClubProvider.prototype, "clubId", void 0);
__decorate([
    column(),
    __metadata("design:type", String)
], ClubProvider.prototype, "provider", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], ClubProvider.prototype, "providerTeamId", void 0);
__decorate([
    column(clubProviderSecretColumnOptions),
    __metadata("design:type", Object)
], ClubProvider.prototype, "accessToken", void 0);
__decorate([
    column(clubProviderSecretColumnOptions),
    __metadata("design:type", Object)
], ClubProvider.prototype, "accessTokenSecret", void 0);
__decorate([
    column(clubProviderSecretColumnOptions),
    __metadata("design:type", Object)
], ClubProvider.prototype, "refreshToken", void 0);
__decorate([
    column.dateTime(),
    __metadata("design:type", Object)
], ClubProvider.prototype, "tokenExpiresAt", void 0);
__decorate([
    column.dateTime(),
    __metadata("design:type", Object)
], ClubProvider.prototype, "lastSyncedAt", void 0);
__decorate([
    column.dateTime({ autoCreate: true }),
    __metadata("design:type", DateTime)
], ClubProvider.prototype, "createdAt", void 0);
__decorate([
    column.dateTime({ autoCreate: true, autoUpdate: true }),
    __metadata("design:type", DateTime)
], ClubProvider.prototype, "updatedAt", void 0);
__decorate([
    belongsTo(() => Club),
    __metadata("design:type", Object)
], ClubProvider.prototype, "club", void 0);
//# sourceMappingURL=club_provider.js.map