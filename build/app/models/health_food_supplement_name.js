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
export default class SupplementsName extends BaseModel {
    static table = 'health_foodsupplementname';
}
__decorate([
    column({ isPrimary: true }),
    __metadata("design:type", Number)
], SupplementsName.prototype, "id", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], SupplementsName.prototype, "nameFr", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], SupplementsName.prototype, "unitFr", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], SupplementsName.prototype, "nameEn", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], SupplementsName.prototype, "unitEn", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], SupplementsName.prototype, "addedById", void 0);
__decorate([
    belongsTo(() => Athlete),
    __metadata("design:type", Object)
], SupplementsName.prototype, "addedBy", void 0);
//# sourceMappingURL=health_food_supplement_name.js.map