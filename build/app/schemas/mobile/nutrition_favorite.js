import { NUTRITION_MEAL_TYPES } from '#constants/nutrition.constants';
import vine from '@vinejs/vine';
export const getNutritionFavoritesQuerySchema = vine.compile(vine.object({
    mealType: vine.enum(Object.values(NUTRITION_MEAL_TYPES)),
}));
export const deleteNutritionFavoriteParamsSchema = vine.compile(vine.object({
    id: vine.string(),
}));
export const deleteNutritionFavoriteSchema = vine.compile(vine.object({
    mealType: vine.enum(Object.values(NUTRITION_MEAL_TYPES)),
}));
export const addNutritionFavoriteSchema = vine.compile(vine.object({
    foodId: vine.string(),
    source: vine.enum(['manual', 'llmAliment']).optional(),
    mealTypes: vine.array(vine.enum(Object.values(NUTRITION_MEAL_TYPES))).minLength(1),
}));
//# sourceMappingURL=nutrition_favorite.js.map