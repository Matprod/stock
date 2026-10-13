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
import Health from '#models_pg/health_rating';
import PainDiscomfortLocation from '#models_pg/pain_discomfort_location';
export default class HealthPain extends BaseModel {
}
__decorate([
    column({ isPrimary: true }),
    __metadata("design:type", String)
], HealthPain.prototype, "id", void 0);
__decorate([
    column(),
    __metadata("design:type", Number)
], HealthPain.prototype, "rating", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], HealthPain.prototype, "healthId", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], HealthPain.prototype, "locationId", void 0);
__decorate([
    column.dateTime({ autoCreate: true }),
    __metadata("design:type", DateTime)
], HealthPain.prototype, "createdAt", void 0);
__decorate([
    column.dateTime({ autoCreate: true, autoUpdate: true }),
    __metadata("design:type", DateTime)
], HealthPain.prototype, "updatedAt", void 0);
__decorate([
    belongsTo(() => Health, { foreignKey: 'healthId' }),
    __metadata("design:type", Object)
], HealthPain.prototype, "health", void 0);
__decorate([
    belongsTo(() => PainDiscomfortLocation, { foreignKey: 'locationId' }),
    __metadata("design:type", Object)
], HealthPain.prototype, "location", void 0);
//# sourceMappingURL=health_pain.js.map