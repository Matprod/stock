import { MIN_NUTRITION_SEARCH_LENGTH, NUTRITION_MEAL_TYPES } from '#constants/nutrition.constants';
import vine from '@vinejs/vine';
export const nutritionDateSchema = vine.compile(vine.object({
    date: vine.date(),
}));
export const nutritionValidationSchema = vine.compile(vine.object({
    athleteId: vine.string(),
    date: vine.date(),
}));
export const updateSkippedMealsSchema = vine.compile(vine.object({
    breakfast_skipped: vine.boolean().optional(),
    lunch_skipped: vine.boolean().optional(),
    dinner_skipped: vine.boolean().optional(),
    meal_type: vine.string().optional(),
}));
export const getNutritionSummaryQuerySchema = vine.compile(vine.object({
    dateOfDay: vine.date({ formats: ['iso8601'] }),
}));
export const getNutritionRecentsQuerySchema = vine.compile(vine.object({
    mealType: vine.enum(Object.values(NUTRITION_MEAL_TYPES)).optional(),
}));
export const addNutritionQuerySchema = vine.compile(vine.object({
    mealType: vine.enum(Object.values(NUTRITION_MEAL_TYPES)),
    dateOfDay: vine.date({ formats: ['iso8601'] }),
}));
export const addNutritionSchema = vine.compile(vine.object({
    recipeId: vine.string().optional(),
    alimentId: vine.string().optional(),
    quantity: vine.number().positive(),
    portion: vine.number().positive().optional(),
    source: vine.enum(['meal', 'llmAliment']),
}));
export const deleteNutritionParamsSchema = vine.compile(vine.object({
    id: vine.string(),
}));
export const getNutritionQuerySchema = vine.compile(vine.object({
    mealType: vine.enum(Object.values(NUTRITION_MEAL_TYPES)),
    dateOfDay: vine.date({ formats: ['iso8601'] }),
}));
export const updateNutritionParamsSchema = vine.compile(vine.object({
    id: vine.string(),
}));
export const updateNutritionSchema = vine.compile(vine.object({
    quantity: vine.number().positive(),
    portion: vine.number().positive().optional(),
}));
export const searchNutritionSchema = vine.compile(vine.object({
    search: vine.string().trim().minLength(MIN_NUTRITION_SEARCH_LENGTH),
    page: vine.number().positive().optional(),
    pageSize: vine.number().positive().optional(),
}));
export const addAlimentSchema = vine.compile(vine.object({
    name: vine.string(),
    portion: vine.number().positive(),
    portionUnit: vine.string(),
    energyKcal: vine.number(),
    waterG: vine.number().optional(),
    proteinsG: vine.number().optional(),
    carbohydrateG: vine.number().optional(),
    fatG: vine.number().optional(),
    glutenG: vine.number().optional(),
    sugarsG: vine.number().optional(),
    fructoseG: vine.number().optional(),
    galactoseG: vine.number().optional(),
    glucoseG: vine.number().optional(),
    lactoseG: vine.number().optional(),
    maltoseG: vine.number().optional(),
    sucroseG: vine.number().optional(),
    starchG: vine.number().optional(),
    fibresG: vine.number().optional(),
    alcoholG: vine.number().optional(),
    faSaturatedG: vine.number().optional(),
    faMonoG: vine.number().optional(),
    faPolyG: vine.number().optional(),
    fa181G: vine.number().optional(),
    fa182G: vine.number().optional(),
    cholesterolMg: vine.number().optional(),
    saltG: vine.number().optional(),
    calciumMg: vine.number().optional(),
    chlorideMg: vine.number().optional(),
    copperMg: vine.number().optional(),
    ironMg: vine.number().optional(),
    iodineMicrog: vine.number().optional(),
    magnesiumMg: vine.number().optional(),
    manganeseMg: vine.number().optional(),
    phosphorusMg: vine.number().optional(),
    potassiumMg: vine.number().optional(),
    seleniumMicrog: vine.number().optional(),
    sodiumMg: vine.number().optional(),
    zincMg: vine.number().optional(),
    vitaminDMicrog: vine.number().optional(),
    vitaminEMg: vine.number().optional(),
    vitaminCMg: vine.number().optional(),
    vitaminB1Mg: vine.number().optional(),
    vitaminB2Mg: vine.number().optional(),
    vitaminB3Mg: vine.number().optional(),
    vitaminB5Mg: vine.number().optional(),
    vitaminB6Mg: vine.number().optional(),
    vitaminB9Microg: vine.number().optional(),
    vitaminB12Microg: vine.number().optional(),
    barcode: vine.number().positive().optional(),
}));
export const getMacroIntervalsQuerySchema = vine.compile(vine.object({
    dateOfDay: vine.date({ formats: ['iso8601'] }),
}));
//# sourceMappingURL=nutrition.js.map