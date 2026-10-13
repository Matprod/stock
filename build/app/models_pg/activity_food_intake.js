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
import Aliment from '#models_pg/aliment';
import SportActivity from '#models_pg/sport_activity';
export default class ActivityFoodIntake extends BaseModel {
    static table = 'sport_activity_intakes';
}
__decorate([
    column({ isPrimary: true }),
    __metadata("design:type", String)
], ActivityFoodIntake.prototype, "id", void 0);
__decorate([
    column(),
    __metadata("design:type", Number)
], ActivityFoodIntake.prototype, "quantity", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], ActivityFoodIntake.prototype, "portion", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], ActivityFoodIntake.prototype, "alimentId", void 0);
__decorate([
    belongsTo(() => Aliment),
    __metadata("design:type", Object)
], ActivityFoodIntake.prototype, "aliment", void 0);
__decorate([
    column(),
    __metadata("design:type", String)
], ActivityFoodIntake.prototype, "sportActivityId", void 0);
__decorate([
    belongsTo(() => SportActivity),
    __metadata("design:type", Object)
], ActivityFoodIntake.prototype, "sportActivity", void 0);
__decorate([
    column.dateTime({ autoCreate: true }),
    __metadata("design:type", DateTime)
], ActivityFoodIntake.prototype, "createdAt", void 0);
__decorate([
    column.dateTime({ autoCreate: true, autoUpdate: true }),
    __metadata("design:type", DateTime)
], ActivityFoodIntake.prototype, "updatedAt", void 0);
//# sourceMappingURL=activity_food_intake.js.map