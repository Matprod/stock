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
import DiscomfortLocation from '#models/discomfort_location';
import SportActivity from '#models/sport_activity';
export default class SportActivityPain extends BaseModel {
    static table = 'sportactivity_painsportactivity';
}
__decorate([
    column({ isPrimary: true }),
    __metadata("design:type", Number)
], SportActivityPain.prototype, "id", void 0);
__decorate([
    column(),
    __metadata("design:type", Number)
], SportActivityPain.prototype, "rating", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], SportActivityPain.prototype, "locationId", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], SportActivityPain.prototype, "sportActivityId", void 0);
__decorate([
    column.dateTime({ autoCreate: true, autoUpdate: true }),
    __metadata("design:type", DateTime)
], SportActivityPain.prototype, "dateUpdated", void 0);
__decorate([
    belongsTo(() => DiscomfortLocation, {
        foreignKey: 'locationId'
    }),
    __metadata("design:type", Object)
], SportActivityPain.prototype, "location", void 0);
__decorate([
    belongsTo(() => SportActivity, {
        foreignKey: 'sportActivityId'
    }),
    __metadata("design:type", Object)
], SportActivityPain.prototype, "sportActivity", void 0);
//# sourceMappingURL=sport_activity_pain.js.map