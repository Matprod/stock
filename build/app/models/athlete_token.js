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
import Athlete from '#models/athlete';
export default class AthleteToken extends BaseModel {
    static table = 'base_token';
}
__decorate([
    column({ isPrimary: true }),
    __metadata("design:type", Number)
], AthleteToken.prototype, "id", void 0);
__decorate([
    column({ serializeAs: null, columnName: 'access_token' }),
    __metadata("design:type", String)
], AthleteToken.prototype, "accessToken", void 0);
__decorate([
    column.dateTime({ columnName: 'access_expiration_date' }),
    __metadata("design:type", DateTime)
], AthleteToken.prototype, "accessExpirationDate", void 0);
__decorate([
    column({ serializeAs: null, columnName: 'refresh_token' }),
    __metadata("design:type", String)
], AthleteToken.prototype, "refreshToken", void 0);
__decorate([
    column.dateTime({ columnName: 'refresh_expiration_date' }),
    __metadata("design:type", DateTime)
], AthleteToken.prototype, "refreshExpirationDate", void 0);
__decorate([
    column({ columnName: 'athlete_id' }),
    __metadata("design:type", Number)
], AthleteToken.prototype, "athleteId", void 0);
__decorate([
    belongsTo(() => Athlete),
    __metadata("design:type", Object)
], AthleteToken.prototype, "athlete", void 0);
//# sourceMappingURL=athlete_token.js.map