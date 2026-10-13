var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
import { BaseModel, column, hasMany, manyToMany } from '@adonisjs/lucid/orm';
import Club from '#models_pg/club';
import Biomarker from '#models_pg/biomarker';
export default class BiomarkerType extends BaseModel {
}
__decorate([
    column({ isPrimary: true }),
    __metadata("design:type", String)
], BiomarkerType.prototype, "id", void 0);
__decorate([
    column(),
    __metadata("design:type", String)
], BiomarkerType.prototype, "name", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], BiomarkerType.prototype, "displayName", void 0);
__decorate([
    column(),
    __metadata("design:type", String)
], BiomarkerType.prototype, "unit", void 0);
__decorate([
    manyToMany(() => Club, {
        pivotTable: 'biomarker_type_clubs',
    }),
    __metadata("design:type", Object)
], BiomarkerType.prototype, "clubs", void 0);
__decorate([
    hasMany(() => Biomarker),
    __metadata("design:type", Object)
], BiomarkerType.prototype, "biomarkers", void 0);
//# sourceMappingURL=biomarker_type.js.map