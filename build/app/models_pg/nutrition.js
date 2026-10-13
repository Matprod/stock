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
import Aliment from '#models_pg/aliment';
import Recipe from '#models_pg/recipe';
import Day from '#models_pg/day';
import LlmAliment from '#models_pg/llm_aliment';
export default class Nutrition extends BaseModel {
    get mealName() {
        if (this.aliment) {
            return this.aliment.name || null;
        }
        else if (this.llmAliment) {
            return this.llmAliment.name || null;
        }
        else if (this.recipe) {
            return this.recipe.name || null;
        }
        return null;
    }
}
__decorate([
    column({ isPrimary: true }),
    __metadata("design:type", String)
], Nutrition.prototype, "id", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], Nutrition.prototype, "mealType", void 0);
__decorate([
    column(),
    __metadata("design:type", Number)
], Nutrition.prototype, "quantity", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], Nutrition.prototype, "portion", void 0);
__decorate([
    column.dateTime({ autoCreate: true }),
    __metadata("design:type", DateTime)
], Nutrition.prototype, "createdAt", void 0);
__decorate([
    column.dateTime({ autoCreate: true, autoUpdate: true }),
    __metadata("design:type", DateTime)
], Nutrition.prototype, "updatedAt", void 0);
__decorate([
    computed(),
    __metadata("design:type", Object),
    __metadata("design:paramtypes", [])
], Nutrition.prototype, "mealName", null);
__decorate([
    column(),
    __metadata("design:type", String)
], Nutrition.prototype, "dayId", void 0);
__decorate([
    belongsTo(() => Day),
    __metadata("design:type", Object)
], Nutrition.prototype, "day", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], Nutrition.prototype, "alimentId", void 0);
__decorate([
    belongsTo(() => Aliment),
    __metadata("design:type", Object)
], Nutrition.prototype, "aliment", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], Nutrition.prototype, "recipeId", void 0);
__decorate([
    belongsTo(() => Recipe),
    __metadata("design:type", Object)
], Nutrition.prototype, "recipe", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], Nutrition.prototype, "llmAlimentId", void 0);
__decorate([
    belongsTo(() => LlmAliment),
    __metadata("design:type", Object)
], Nutrition.prototype, "llmAliment", void 0);
//# sourceMappingURL=nutrition.js.map