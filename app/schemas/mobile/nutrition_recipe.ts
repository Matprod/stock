import { NUTRITION_MEAL_TYPES } from '#constants/nutrition.constants'
import vine from '@vinejs/vine'

const recipeMealSchema = vine.object({
  quantity: vine.number().positive(),
  portion: vine.number().positive(),
  meal: vine.number().positive(),
})

export const addRecipeSchema = vine.compile(
  vine.object({
    mealTypes: vine.array(vine.enum(Object.values(NUTRITION_MEAL_TYPES))),
    name: vine.string().minLength(1),
    recipeMeals: vine.array(recipeMealSchema),
  })
)

export const getRecipesQuerySchema = vine.compile(
  vine.object({
    mealType: vine.enum(Object.values(NUTRITION_MEAL_TYPES)).optional(),
  })
)

export const updateRecipeParamsSchema = vine.compile(
  vine.object({
    id: vine.string(),
  })
)

export const deleteRecipeParamsSchema = vine.compile(
  vine.object({
    id: vine.string(),
  })
)
