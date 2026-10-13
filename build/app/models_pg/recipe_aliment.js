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
import Recipe from '#models_pg/recipe';
export default class RecipeAliment extends BaseModel {
}
__decorate([
    column({ isPrimary: true }),
    __metadata("design:type", String)
], RecipeAliment.prototype, "id", void 0);
__decorate([
    column(),
    __metadata("design:type", Number)
], RecipeAliment.prototype, "quantity", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], RecipeAliment.prototype, "portion", void 0);
__decorate([
    column(),
    __metadata("design:type", String)
], RecipeAliment.prototype, "mealId", void 0);
__decorate([
    belongsTo(() => Aliment),
    __metadata("design:type", Object)
], RecipeAliment.prototype, "meal", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], RecipeAliment.prototype, "recipeId", void 0);
__decorate([
    belongsTo(() => Recipe),
    __metadata("design:type", Object)
], RecipeAliment.prototype, "recipe", void 0);
__decorate([
    column.dateTime({ autoCreate: true }),
    __metadata("design:type", DateTime)
], RecipeAliment.prototype, "createdAt", void 0);
__decorate([
    column.dateTime({ autoCreate: true, autoUpdate: true }),
    __metadata("design:type", DateTime)
], RecipeAliment.prototype, "updatedAt", void 0);
//# sourceMappingURL=recipe_aliment.js.map