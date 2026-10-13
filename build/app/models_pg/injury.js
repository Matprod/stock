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
import Athlete from '#models_pg/athlete';
import InjuryType from '#models_pg/injury_type';
export default class Injury extends BaseModel {
}
__decorate([
    column({ isPrimary: true }),
    __metadata("design:type", String)
], Injury.prototype, "id", void 0);
__decorate([
    column.date(),
    __metadata("design:type", Object)
], Injury.prototype, "dateOfInjury", void 0);
__decorate([
    column.date(),
    __metadata("design:type", Object)
], Injury.prototype, "recoveryDate", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], Injury.prototype, "context", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], Injury.prototype, "contactType", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], Injury.prototype, "note", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], Injury.prototype, "typeOfInjuryId", void 0);
__decorate([
    belongsTo(() => InjuryType, {
        foreignKey: 'typeOfInjuryId',
    }),
    __metadata("design:type", Object)
], Injury.prototype, "injuryType", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], Injury.prototype, "mechanism", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], Injury.prototype, "tissue", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], Injury.prototype, "angle", void 0);
__decorate([
    column({ consume: (value) => value?.replace(/\s+/gu, ' ').trim() }),
    __metadata("design:type", Object)
], Injury.prototype, "pathology", void 0);
__decorate([
    column(),
    __metadata("design:type", String)
], Injury.prototype, "athleteId", void 0);
__decorate([
    column(),
    __metadata("design:type", String)
], Injury.prototype, "source", void 0);
__decorate([
    belongsTo(() => Athlete),
    __metadata("design:type", Object)
], Injury.prototype, "athlete", void 0);
//# sourceMappingURL=injury.js.map