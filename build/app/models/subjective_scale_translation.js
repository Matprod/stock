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
import { BaseModel, column } from '@adonisjs/lucid/orm';
export default class SubjectiveScaleTranslation extends BaseModel {
    static table = 'translations';
}
__decorate([
    column({ isPrimary: true }),
    __metadata("design:type", String)
], SubjectiveScaleTranslation.prototype, "id", void 0);
__decorate([
    column(),
    __metadata("design:type", String)
], SubjectiveScaleTranslation.prototype, "language", void 0);
__decorate([
    column(),
    __metadata("design:type", String)
], SubjectiveScaleTranslation.prototype, "translatableType", void 0);
__decorate([
    column(),
    __metadata("design:type", String)
], SubjectiveScaleTranslation.prototype, "translatableId", void 0);
__decorate([
    column(),
    __metadata("design:type", String)
], SubjectiveScaleTranslation.prototype, "key", void 0);
__decorate([
    column(),
    __metadata("design:type", String)
], SubjectiveScaleTranslation.prototype, "value", void 0);
__decorate([
    column.dateTime({ autoCreate: true }),
    __metadata("design:type", DateTime)
], SubjectiveScaleTranslation.prototype, "createdAt", void 0);
__decorate([
    column.dateTime({ autoCreate: true, autoUpdate: true }),
    __metadata("design:type", DateTime)
], SubjectiveScaleTranslation.prototype, "updatedAt", void 0);
//# sourceMappingURL=subjective_scale_translation.js.map