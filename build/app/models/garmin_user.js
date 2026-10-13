var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm';
import Athlete from '#models/athlete';
export default class GarminUser extends BaseModel {
    static table = 'base_garminathlete';
}
__decorate([
    column({ isPrimary: true }),
    __metadata("design:type", Number)
], GarminUser.prototype, "id", void 0);
__decorate([
    column({ columnName: 'access_token' }),
    __metadata("design:type", Object)
], GarminUser.prototype, "accessToken", void 0);
__decorate([
    column({ columnName: 'access_token_secret' }),
    __metadata("design:type", Object)
], GarminUser.prototype, "accessTokenSecret", void 0);
__decorate([
    column({ columnName: 'garmin_user_id' }),
    __metadata("design:type", Object)
], GarminUser.prototype, "garminUserId", void 0);
__decorate([
    column({ columnName: 'athlete_id' }),
    __metadata("design:type", Number)
], GarminUser.prototype, "athleteId", void 0);
__decorate([
    belongsTo(() => Athlete, { foreignKey: 'athleteId' }),
    __metadata("design:type", Object)
], GarminUser.prototype, "athlete", void 0);
//# sourceMappingURL=garmin_user.js.map