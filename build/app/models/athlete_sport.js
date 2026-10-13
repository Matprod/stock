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
import Sport from '#models/sport';
export default class AthleteSport extends BaseModel {
    static table = 'base_athlete_sports';
}
__decorate([
    column({ isPrimary: true }),
    __metadata("design:type", Number)
], AthleteSport.prototype, "id", void 0);
__decorate([
    column(),
    __metadata("design:type", Number)
], AthleteSport.prototype, "athleteId", void 0);
__decorate([
    column(),
    __metadata("design:type", Number)
], AthleteSport.prototype, "sportId", void 0);
__decorate([
    belongsTo(() => Athlete),
    __metadata("design:type", Object)
], AthleteSport.prototype, "athlete", void 0);
__decorate([
    belongsTo(() => Sport),
    __metadata("design:type", Object)
], AthleteSport.prototype, "sport", void 0);
//# sourceMappingURL=athlete_sport.js.map