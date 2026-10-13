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
import { BaseModel, column, belongsTo, computed } from '@adonisjs/lucid/orm';
import Aliment from '#models/aliment';
import Recipe from '#models/recipe';
import Day from '#models/day';
import ChatGPTNutrition from '#models/chatgpt_nutrition';
export default class Nutrition extends BaseModel {
    static table = 'nutrition_nutrition';
    get mealName() {
        if (this.meal) {
            return this.meal.alimNomEng || this.meal.alimNomFr || null;
        }
        else if (this.chatgptMeal) {
            return this.chatgptMeal.name || this.chatgptMeal.nameFr || null;
        }
        else if (this.recipe) {
            return this.recipe.name || null;
        }
        return null;
    }
}
__decorate([
    column({ isPrimary: true }),
    __metadata("design:type", Number)
], Nutrition.prototype, "id", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], Nutrition.prototype, "mealType", void 0);
__decorate([
    column.dateTime({ autoCreate: true }),
    __metadata("design:type", Object)
], Nutrition.prototype, "dateAdded", void 0);
__decorate([
    column(),
    __metadata("design:type", Number)
], Nutrition.prototype, "quantity", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], Nutrition.prototype, "portion", void 0);
__decorate([
    column.dateTime({ autoCreate: true, autoUpdate: true }),
    __metadata("design:type", DateTime)
], Nutrition.prototype, "dateUpdated", void 0);
__decorate([
    computed(),
    __metadata("design:type", Object),
    __metadata("design:paramtypes", [])
], Nutrition.prototype, "mealName", null);
__decorate([
    column(),
    __metadata("design:type", Number)
], Nutrition.prototype, "athleteDayId", void 0);
__decorate([
    belongsTo(() => Day, {
        foreignKey: 'athleteDayId',
    }),
    __metadata("design:type", Object)
], Nutrition.prototype, "day", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], Nutrition.prototype, "mealId", void 0);
__decorate([
    belongsTo(() => Aliment, {
        foreignKey: 'mealId',
    }),
    __metadata("design:type", Object)
], Nutrition.prototype, "meal", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], Nutrition.prototype, "recipeId", void 0);
__decorate([
    belongsTo(() => Recipe),
    __metadata("design:type", Object)
], Nutrition.prototype, "recipe", void 0);
__decorate([
    column({ columnName: 'chatgpt_meal_id' }),
    __metadata("design:type", Object)
], Nutrition.prototype, "chatgptMealId", void 0);
__decorate([
    belongsTo(() => ChatGPTNutrition, {
        foreignKey: 'chatgptMealId',
    }),
    __metadata("design:type", Object)
], Nutrition.prototype, "chatgptMeal", void 0);
//# sourceMappingURL=nutrition.js.map