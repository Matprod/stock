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
import Athlete from '#models/athlete';
import DiscomfortLocation from '#models/discomfort_location';
export default class Discomfort extends BaseModel {
    static table = 'base_registerdiscomfort';
}
__decorate([
    column({ isPrimary: true }),
    __metadata("design:type", Number)
], Discomfort.prototype, "id", void 0);
__decorate([
    column.date(),
    __metadata("design:type", Object)
], Discomfort.prototype, "dateOfDiscomfort", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], Discomfort.prototype, "levelOfPainToday", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], Discomfort.prototype, "during", void 0);
__decorate([
    column.date(),
    __metadata("design:type", Object)
], Discomfort.prototype, "recoveryDate", void 0);
__decorate([
    column(),
    __metadata("design:type", Number)
], Discomfort.prototype, "locationId", void 0);
__decorate([
    belongsTo(() => DiscomfortLocation, { foreignKey: 'locationId' }),
    __metadata("design:type", Object)
], Discomfort.prototype, "location", void 0);
__decorate([
    column(),
    __metadata("design:type", Number)
], Discomfort.prototype, "athleteId", void 0);
__decorate([
    belongsTo(() => Athlete),
    __metadata("design:type", Object)
], Discomfort.prototype, "athlete", void 0);
//# sourceMappingURL=discomfort.js.map