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
import Aliment from '#models/aliment';
import SportActivity from '#models/sport_activity';
import Nutrition from '#models/nutrition';
export default class FoodIntake extends BaseModel {
    static table = 'sportactivity_foodintake';
}
__decorate([
    column({ isPrimary: true }),
    __metadata("design:type", Number)
], FoodIntake.prototype, "id", void 0);
__decorate([
    column(),
    __metadata("design:type", Number)
], FoodIntake.prototype, "quantity", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], FoodIntake.prototype, "portion", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], FoodIntake.prototype, "foodId", void 0);
__decorate([
    belongsTo(() => Aliment, {
        foreignKey: 'foodId',
    }),
    __metadata("design:type", Object)
], FoodIntake.prototype, "food", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], FoodIntake.prototype, "nutritionId", void 0);
__decorate([
    belongsTo(() => Nutrition, {
        foreignKey: 'nutritionId',
    }),
    __metadata("design:type", Object)
], FoodIntake.prototype, "nutrition", void 0);
__decorate([
    column(),
    __metadata("design:type", Number)
], FoodIntake.prototype, "sportActivityId", void 0);
__decorate([
    belongsTo(() => SportActivity),
    __metadata("design:type", Object)
], FoodIntake.prototype, "sportActivity", void 0);
__decorate([
    column.dateTime({ autoCreate: true, autoUpdate: true }),
    __metadata("design:type", DateTime)
], FoodIntake.prototype, "dateUpdated", void 0);
//# sourceMappingURL=food_intake.js.map