var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
import { BaseModel, column, belongsTo, computed } from '@adonisjs/lucid/orm';
import Athlete from '#models/athlete';
import Aliment from '#models/aliment';
import ChatGPTNutrition from '#models/chatgpt_nutrition';
export default class NutritionFavorite extends BaseModel {
    static table = 'nutrition_athletefavoritefood';
    get source() {
        if (this.foodId) {
            return 'meal';
        }
        return 'chatgptMeal';
    }
}
__decorate([
    column({ isPrimary: true }),
    __metadata("design:type", Number)
], NutritionFavorite.prototype, "id", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], NutritionFavorite.prototype, "mealType", void 0);
__decorate([
    column.dateTime({ autoCreate: true }),
    __metadata("design:type", Object)
], NutritionFavorite.prototype, "dateAddedAsFavorite", void 0);
__decorate([
    column(),
    __metadata("design:type", Number)
], NutritionFavorite.prototype, "athleteId", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], NutritionFavorite.prototype, "foodId", void 0);
__decorate([
    column({
        prepare: (value) => value === null || value === undefined ? null : value.join(','),
        consume: (value) => value === null || value === undefined ? [] : value.split(','),
    }),
    __metadata("design:type", Array)
], NutritionFavorite.prototype, "mealTypes", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], NutritionFavorite.prototype, "chatgptFoodId", void 0);
__decorate([
    computed(),
    __metadata("design:type", String),
    __metadata("design:paramtypes", [])
], NutritionFavorite.prototype, "source", null);
__decorate([
    belongsTo(() => Athlete, { foreignKey: 'athleteId' }),
    __metadata("design:type", Object)
], NutritionFavorite.prototype, "athlete", void 0);
__decorate([
    belongsTo(() => Aliment, { foreignKey: 'foodId' }),
    __metadata("design:type", Object)
], NutritionFavorite.prototype, "food", void 0);
__decorate([
    belongsTo(() => ChatGPTNutrition, { foreignKey: 'chatgptFoodId' }),
    __metadata("design:type", Object)
], NutritionFavorite.prototype, "chatgptFood", void 0);
//# sourceMappingURL=nutrition_favorite.js.map