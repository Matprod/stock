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
import SportActivity from '#models/sport_activity';
export default class FitData extends BaseModel {
    static table = 'sportactivity_fitdata';
}
__decorate([
    column({ isPrimary: true }),
    __metadata("design:type", Number)
], FitData.prototype, "id", void 0);
__decorate([
    column({ columnName: 'data', consume: (value) => value || null }),
    __metadata("design:type", Object)
], FitData.prototype, "data", void 0);
__decorate([
    column({ columnName: 'sport_activity_id' }),
    __metadata("design:type", Number)
], FitData.prototype, "sportActivityId", void 0);
__decorate([
    belongsTo(() => SportActivity, {
        foreignKey: 'sportActivityId',
    }),
    __metadata("design:type", Object)
], FitData.prototype, "sportActivity", void 0);
//# sourceMappingURL=fit_data.js.map