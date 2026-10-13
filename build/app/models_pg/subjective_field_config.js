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
import { DateTime } from 'luxon';
import Club from '#models_pg/club';
export default class SubjectiveFieldConfig extends BaseModel {
}
__decorate([
    column({ isPrimary: true }),
    __metadata("design:type", String)
], SubjectiveFieldConfig.prototype, "id", void 0);
__decorate([
    column(),
    __metadata("design:type", String)
], SubjectiveFieldConfig.prototype, "clubId", void 0);
__decorate([
    column(),
    __metadata("design:type", String)
], SubjectiveFieldConfig.prototype, "fieldName", void 0);
__decorate([
    column(),
    __metadata("design:type", String)
], SubjectiveFieldConfig.prototype, "domain", void 0);
__decorate([
    column(),
    __metadata("design:type", Number)
], SubjectiveFieldConfig.prototype, "minScale", void 0);
__decorate([
    column(),
    __metadata("design:type", Number)
], SubjectiveFieldConfig.prototype, "maxScale", void 0);
__decorate([
    column(),
    __metadata("design:type", Boolean)
], SubjectiveFieldConfig.prototype, "isReversed", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], SubjectiveFieldConfig.prototype, "gap", void 0);
__decorate([
    column.dateTime({ autoCreate: true }),
    __metadata("design:type", DateTime)
], SubjectiveFieldConfig.prototype, "createdAt", void 0);
__decorate([
    column.dateTime({ autoCreate: true, autoUpdate: true }),
    __metadata("design:type", DateTime)
], SubjectiveFieldConfig.prototype, "updatedAt", void 0);
__decorate([
    belongsTo(() => Club),
    __metadata("design:type", Object)
], SubjectiveFieldConfig.prototype, "club", void 0);
//# sourceMappingURL=subjective_field_config.js.map