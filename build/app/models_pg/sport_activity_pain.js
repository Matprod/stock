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
import PainDiscomfortLocation from '#models_pg/pain_discomfort_location';
import SportActivity from '#models_pg/sport_activity';
export default class SportActivityPain extends BaseModel {
}
__decorate([
    column({ isPrimary: true }),
    __metadata("design:type", String)
], SportActivityPain.prototype, "id", void 0);
__decorate([
    column(),
    __metadata("design:type", Number)
], SportActivityPain.prototype, "rating", void 0);
__decorate([
    column(),
    __metadata("design:type", String)
], SportActivityPain.prototype, "locationId", void 0);
__decorate([
    column(),
    __metadata("design:type", String)
], SportActivityPain.prototype, "sportActivityId", void 0);
__decorate([
    column.dateTime({ autoCreate: true }),
    __metadata("design:type", DateTime)
], SportActivityPain.prototype, "createdAt", void 0);
__decorate([
    column.dateTime({ autoCreate: true, autoUpdate: true }),
    __metadata("design:type", DateTime)
], SportActivityPain.prototype, "updatedAt", void 0);
__decorate([
    belongsTo(() => PainDiscomfortLocation, {
        foreignKey: 'locationId',
    }),
    __metadata("design:type", Object)
], SportActivityPain.prototype, "location", void 0);
__decorate([
    belongsTo(() => SportActivity),
    __metadata("design:type", Object)
], SportActivityPain.prototype, "sportActivity", void 0);
//# sourceMappingURL=sport_activity_pain.js.map