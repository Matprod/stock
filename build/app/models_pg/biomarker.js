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
import BiomarkerType from '#models_pg/biomarker_type';
export default class Biomarker extends BaseModel {
}
__decorate([
    column({ isPrimary: true }),
    __metadata("design:type", String)
], Biomarker.prototype, "id", void 0);
__decorate([
    column(),
    __metadata("design:type", String)
], Biomarker.prototype, "value", void 0);
__decorate([
    column.dateTime(),
    __metadata("design:type", DateTime)
], Biomarker.prototype, "measuredAt", void 0);
__decorate([
    column(),
    __metadata("design:type", String)
], Biomarker.prototype, "athleteId", void 0);
__decorate([
    column(),
    __metadata("design:type", String)
], Biomarker.prototype, "biomarkerTypeId", void 0);
__decorate([
    belongsTo(() => Athlete),
    __metadata("design:type", Object)
], Biomarker.prototype, "athlete", void 0);
__decorate([
    belongsTo(() => BiomarkerType),
    __metadata("design:type", Object)
], Biomarker.prototype, "biomarkerType", void 0);
//# sourceMappingURL=biomarker.js.map