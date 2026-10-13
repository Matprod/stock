import { SNACK_DB_MEAL_TYPES, NutritionMealType } from '#constants/nutrition.constants'
import NutritionFavorite from '#models_pg/favorite_aliments'
import { addNutritionFavoriteSchema } from '#schemas/mobile/nutrition_favorite'
import { Infer } from '@vinejs/vine/types'

export default class NutritionFavoritesService {
  async getFavorites(athleteId: string, mealType: NutritionMealType) {
    const mealTypes: string[] = mealType.toLowerCase().includes('snack')
      ? [...SNACK_DB_MEAL_TYPES]
      : [mealType]

    return NutritionFavorite.query()
      .where('athleteId', athleteId)
      .where((builder) => {
        builder.where((sub) => {
          mealTypes.forEach((type, index) => {
            if (index === 0) {
              sub.where('meal_types', '@>', [type])
            } else {
              sub.orWhere('meal_types', '@>', [type])
            }
          })
        })
      })
      .preload('aliment')
      .preload('llmAliment')
  }

  async deleteFavorite(athleteId: string, id: string, mealType: NutritionMealType) {
    const existingFavorite = await NutritionFavorite.query()
      .where('athleteId', athleteId)
      .where('id', id)
      .first()

    if (!existingFavorite) {
      throw new Error('Favorite not found')
    }

    const typesToRemove: string[] = mealType.toLowerCase().includes('snack')
      ? [...SNACK_DB_MEAL_TYPES]
      : [mealType]
    const newMealTypes = existingFavorite.mealTypes.filter(
      (type) => !typesToRemove.includes(type)
    )

    if (newMealTypes.length === 0) {
      await existingFavorite.delete()
    } else {
      await existingFavorite.merge({ mealTypes: newMealTypes }).save()
    }

    return {
      message: 'Favorite deleted successfully',
    }
  }

  async addFavorite(athleteId: string, payload: Infer<typeof addNutritionFavoriteSchema>) {
    const { foodId, source = 'manual', mealTypes } = payload

    const existingFavorite = await NutritionFavorite.query()
      .where('athleteId', athleteId)
      .if(source === 'manual', (q) => q.where('alimentId', foodId))
      .if(source === 'llmAliment', (q) => q.where('llmAlimentId', foodId))
      .first()

    if (existingFavorite) {
      const newMealTypes = new Set([...existingFavorite.mealTypes, ...mealTypes])
      await existingFavorite.merge({ mealTypes: Array.from(newMealTypes) }).save()
      return existingFavorite
    }

    const favorite = await NutritionFavorite.create({
      athleteId,
      alimentId: source === 'manual' ? foodId : null,
      llmAlimentId: source === 'llmAliment' ? foodId : null,
      mealTypes,
    })

    await favorite.load('aliment')
    await favorite.load('llmAliment')

    return favorite
  }
}
