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
import Period from '#models/period';
export default class Serie extends BaseModel {
}
__decorate([
    column({ isPrimary: true }),
    __metadata("design:type", Number)
], Serie.prototype, "id", void 0);
__decorate([
    column(),
    __metadata("design:type", String)
], Serie.prototype, "type", void 0);
__decorate([
    column(),
    __metadata("design:type", String)
], Serie.prototype, "dataEncoded", void 0);
__decorate([
    column(),
    __metadata("design:type", Number)
], Serie.prototype, "samplesPerMinute", void 0);
__decorate([
    column(),
    __metadata("design:type", String)
], Serie.prototype, "dataType", void 0);
__decorate([
    column(),
    __metadata("design:type", Number)
], Serie.prototype, "bits", void 0);
__decorate([
    column(),
    __metadata("design:type", Number)
], Serie.prototype, "periodId", void 0);
__decorate([
    belongsTo(() => Period, {
        foreignKey: 'periodId',
        localKey: 'id',
    }),
    __metadata("design:type", Object)
], Serie.prototype, "period", void 0);
__decorate([
    column.dateTime({ autoCreate: true }),
    __metadata("design:type", DateTime)
], Serie.prototype, "createdAt", void 0);
__decorate([
    column.dateTime({ autoCreate: true, autoUpdate: true }),
    __metadata("design:type", DateTime)
], Serie.prototype, "updatedAt", void 0);
//# sourceMappingURL=serie.js.map