var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
import { BaseModel, column, hasMany } from '@adonisjs/lucid/orm';
import AthleteSport from '#models/athlete_sport';
import Club from '#models/club';
export default class Sport extends BaseModel {
    static table = 'base_sport';
}
__decorate([
    column({ isPrimary: true }),
    __metadata("design:type", Number)
], Sport.prototype, "id", void 0);
__decorate([
    column(),
    __metadata("design:type", String)
], Sport.prototype, "nameFr", void 0);
__decorate([
    column(),
    __metadata("design:type", String)
], Sport.prototype, "nameEn", void 0);
__decorate([
    hasMany(() => AthleteSport),
    __metadata("design:type", Object)
], Sport.prototype, "athleteSports", void 0);
__decorate([
    hasMany(() => Club),
    __metadata("design:type", Object)
], Sport.prototype, "clubs", void 0);
//# sourceMappingURL=sport.js.map