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
export default class TypeOfSymptom extends BaseModel {
    static table = 'base_typeofsymptom';
}
__decorate([
    column({ isPrimary: true }),
    __metadata("design:type", Number)
], TypeOfSymptom.prototype, "id", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], TypeOfSymptom.prototype, "nameFr", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], TypeOfSymptom.prototype, "definitionFr", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], TypeOfSymptom.prototype, "nameEn", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], TypeOfSymptom.prototype, "definitionEn", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], TypeOfSymptom.prototype, "addedById", void 0);
__decorate([
    belongsTo(() => Athlete, {
        foreignKey: 'added_by_id',
    }),
    __metadata("design:type", Object)
], TypeOfSymptom.prototype, "addedBy", void 0);
__decorate([
    column.dateTime({ autoCreate: true }),
    __metadata("design:type", DateTime)
], TypeOfSymptom.prototype, "createdAt", void 0);
__decorate([
    column.dateTime({ autoCreate: true, autoUpdate: true }),
    __metadata("design:type", DateTime)
], TypeOfSymptom.prototype, "updatedAt", void 0);
//# sourceMappingURL=type_of_symptom.js.map