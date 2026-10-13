import { SNACK_DB_MEAL_TYPES, NutritionMealType } from '#constants/nutrition.constants'
import Recipe from '#models_pg/recipe'
import { addRecipeSchema } from '#schemas/mobile/nutrition_recipe'
import { Infer } from '@vinejs/vine/types'

export default class NutritionRecipesService {
  async deleteRecipe(athleteId: string, id: string) {
    const recipe = await Recipe.query().where('id', id).where('athleteId', athleteId).first()

    if (!recipe) {
      return null
    }

    await recipe.related('recipeAliments').query().delete()
    await recipe.delete()
  }

  async getRecipes(athleteId: string, mealType?: NutritionMealType) {
    return Recipe.query()
      .where('athleteId', athleteId)
      .if(mealType, (query) => {
        const mealTypes = mealType!.toLowerCase().includes('snack')
          ? [...SNACK_DB_MEAL_TYPES]
          : [mealType!]
        query.where((sub) => {
          mealTypes.forEach((type, index) => {
            if (index === 0) {
              sub.whereRaw('FIND_IN_SET(?, meal_type) > 0', [type])
            } else {
              sub.orWhereRaw('FIND_IN_SET(?, meal_type) > 0', [type])
            }
          })
        })
      })
      .preload('recipeAliments', (recipeAlimentsQuery) => {
        recipeAlimentsQuery.preload('meal')
      })
  }

  async addRecipe(athleteId: string, payload: Infer<typeof addRecipeSchema> & { id?: string }) {
    const { mealTypes, name, recipeMeals } = payload

    if (payload.id) {
      const recipe = await Recipe.query()
        .where('id', payload.id)
        .where('athleteId', athleteId)
        .preload('recipeAliments')
        .first()

      if (!recipe) {
        return null
      }

      await recipe
        .merge({
          name,
          mealType: mealTypes,
        })
        .save()

      const existingMealsByMealId = new Map(
        recipe.recipeAliments.map((recipeAliment) => [recipeAliment.mealId, recipeAliment] as const)
      )

      const payloadMealIds = new Set<string>(recipeMeals.map((meal) => String(meal.meal)))

      const mealIdsToDelete = recipe.recipeAliments
        .filter((recipeAliment) => !payloadMealIds.has(recipeAliment.mealId))
        .map((recipeAliment) => recipeAliment.mealId)

      if (mealIdsToDelete.length > 0) {
        await recipe
          .related('recipeAliments')
          .query()
          .whereIn('mealId', mealIdsToDelete)
          .delete()
      }

      for (const meal of recipeMeals) {
        const mealId = String(meal.meal)
        const existing = existingMealsByMealId.get(mealId)

        if (existing) {
          existing.merge({
            quantity: meal.quantity,
            portion: meal.portion,
          })
          await existing.save()
        } else {
          await recipe.related('recipeAliments').create({
            quantity: meal.quantity,
            portion: meal.portion,
            mealId,
          })
        }
      }
    } else {
      const recipe = await Recipe.create({
        athleteId,
        name,
        mealType: mealTypes,
      })

      await recipe.related('recipeAliments').createMany(
        recipeMeals.map((meal) => ({
          quantity: meal.quantity,
          portion: meal.portion,
          mealId: String(meal.meal),
        }))
      )
    }
  }
}
