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
import Athlete from '#models_pg/athlete';
export default class Disease extends BaseModel {
}
__decorate([
    column({ isPrimary: true }),
    __metadata("design:type", String)
], Disease.prototype, "id", void 0);
__decorate([
    column.date(),
    __metadata("design:type", Object)
], Disease.prototype, "startDate", void 0);
__decorate([
    column.date(),
    __metadata("design:type", Object)
], Disease.prototype, "endDate", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], Disease.prototype, "note", void 0);
__decorate([
    column(),
    __metadata("design:type", String)
], Disease.prototype, "source", void 0);
__decorate([
    column(),
    __metadata("design:type", String)
], Disease.prototype, "name", void 0);
__decorate([
    column(),
    __metadata("design:type", String)
], Disease.prototype, "athleteId", void 0);
__decorate([
    belongsTo(() => Athlete),
    __metadata("design:type", Object)
], Disease.prototype, "athlete", void 0);
__decorate([
    column.dateTime({ autoCreate: true }),
    __metadata("design:type", DateTime)
], Disease.prototype, "createdAt", void 0);
__decorate([
    column.dateTime({ autoCreate: true, autoUpdate: true }),
    __metadata("design:type", DateTime)
], Disease.prototype, "updatedAt", void 0);
//# sourceMappingURL=disease.js.map