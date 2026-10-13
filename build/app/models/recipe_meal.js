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
import Recipe from '#models/recipe';
export default class RecipeMeal extends BaseModel {
    static table = 'nutrition_recipemeal';
}
__decorate([
    column({ isPrimary: true }),
    __metadata("design:type", Number)
], RecipeMeal.prototype, "id", void 0);
__decorate([
    column(),
    __metadata("design:type", Number)
], RecipeMeal.prototype, "quantity", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], RecipeMeal.prototype, "portion", void 0);
__decorate([
    column(),
    __metadata("design:type", Number)
], RecipeMeal.prototype, "mealId", void 0);
__decorate([
    belongsTo(() => Aliment, {
        foreignKey: 'mealId',
    }),
    __metadata("design:type", Object)
], RecipeMeal.prototype, "meal", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], RecipeMeal.prototype, "recipeId", void 0);
__decorate([
    belongsTo(() => Recipe),
    __metadata("design:type", Object)
], RecipeMeal.prototype, "recipe", void 0);
__decorate([
    column.dateTime({ autoCreate: true, autoUpdate: true }),
    __metadata("design:type", DateTime)
], RecipeMeal.prototype, "dateUpdated", void 0);
//# sourceMappingURL=recipe_meal.js.map