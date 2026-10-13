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
import { BaseModel, column, belongsTo, hasMany } from '@adonisjs/lucid/orm';
import Athlete from '#models/athlete';
import RecipeMeal from '#models/recipe_meal';
export default class Recipe extends BaseModel {
    static table = 'nutrition_recipe';
}
__decorate([
    column({ isPrimary: true }),
    __metadata("design:type", Number)
], Recipe.prototype, "id", void 0);
__decorate([
    column(),
    __metadata("design:type", String)
], Recipe.prototype, "name", void 0);
__decorate([
    column({
        prepare: (value) => value === null || value === undefined ? null : value.join(','),
        consume: (value) => value === null || value === undefined ? [] : value.split(','),
    }),
    __metadata("design:type", Array)
], Recipe.prototype, "mealType", void 0);
__decorate([
    column.dateTime({ autoCreate: true }),
    __metadata("design:type", Object)
], Recipe.prototype, "dateAdded", void 0);
__decorate([
    column.dateTime({ autoCreate: true, autoUpdate: true }),
    __metadata("design:type", DateTime)
], Recipe.prototype, "dateUpdated", void 0);
__decorate([
    column(),
    __metadata("design:type", Number)
], Recipe.prototype, "athleteId", void 0);
__decorate([
    belongsTo(() => Athlete),
    __metadata("design:type", Object)
], Recipe.prototype, "athlete", void 0);
__decorate([
    hasMany(() => RecipeMeal),
    __metadata("design:type", Object)
], Recipe.prototype, "recipeMeals", void 0);
//# sourceMappingURL=recipe.js.map