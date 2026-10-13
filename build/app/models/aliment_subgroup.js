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
import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm';
import AlimentGroup from '#models/aliment_group';
export default class AlimentSubgroup extends BaseModel {
    static table = 'nutrition_alimentsubgroup';
}
__decorate([
    column({ isPrimary: true }),
    __metadata("design:type", Number)
], AlimentSubgroup.prototype, "id", void 0);
__decorate([
    column(),
    __metadata("design:type", Number)
], AlimentSubgroup.prototype, "alimSsgrpCode", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], AlimentSubgroup.prototype, "alimSsgrpNomEng", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], AlimentSubgroup.prototype, "alimSsgrpNomFr", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], AlimentSubgroup.prototype, "groupId", void 0);
__decorate([
    belongsTo(() => AlimentGroup),
    __metadata("design:type", Object)
], AlimentSubgroup.prototype, "group", void 0);
__decorate([
    column.dateTime({ autoCreate: true }),
    __metadata("design:type", DateTime)
], AlimentSubgroup.prototype, "createdAt", void 0);
__decorate([
    column.dateTime({ autoCreate: true, autoUpdate: true }),
    __metadata("design:type", DateTime)
], AlimentSubgroup.prototype, "updatedAt", void 0);
//# sourceMappingURL=aliment_subgroup.js.map