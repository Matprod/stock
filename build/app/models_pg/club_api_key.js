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
export default class ClubApiKey extends BaseModel {
}
__decorate([
    column({ isPrimary: true }),
    __metadata("design:type", String)
], ClubApiKey.prototype, "id", void 0);
__decorate([
    column(),
    __metadata("design:type", String)
], ClubApiKey.prototype, "clubId", void 0);
__decorate([
    column(),
    __metadata("design:type", String)
], ClubApiKey.prototype, "name", void 0);
__decorate([
    column(),
    __metadata("design:type", String)
], ClubApiKey.prototype, "keyPrefix", void 0);
__decorate([
    column({ serializeAs: null }),
    __metadata("design:type", String)
], ClubApiKey.prototype, "keyHash", void 0);
__decorate([
    column.dateTime(),
    __metadata("design:type", Object)
], ClubApiKey.prototype, "lastUsedAt", void 0);
__decorate([
    column.dateTime(),
    __metadata("design:type", Object)
], ClubApiKey.prototype, "revokedAt", void 0);
__decorate([
    column.dateTime({ autoCreate: true }),
    __metadata("design:type", DateTime)
], ClubApiKey.prototype, "createdAt", void 0);
__decorate([
    column.dateTime({ autoCreate: true, autoUpdate: true }),
    __metadata("design:type", DateTime)
], ClubApiKey.prototype, "updatedAt", void 0);
__decorate([
    belongsTo(() => Club),
    __metadata("design:type", Object)
], ClubApiKey.prototype, "club", void 0);
//# sourceMappingURL=club_api_key.js.map