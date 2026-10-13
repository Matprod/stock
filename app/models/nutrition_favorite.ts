import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo, computed } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Athlete from '#models/athlete'
import Aliment from '#models/aliment'
import ChatGPTNutrition from '#models/chatgpt_nutrition'
import { NutritionMealType } from '#constants/nutrition.constants'

export default class NutritionFavorite extends BaseModel {
  static table = 'nutrition_athletefavoritefood'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare mealType: NutritionMealType | null

  @column.dateTime({ autoCreate: true })
  declare dateAddedAsFavorite: DateTime | null

  @column()
  declare athleteId: number

  @column()
  declare foodId: number | null

  @column({
    prepare: (value: NutritionMealType[] | null) =>
      value === null || value === undefined ? null : value.join(','),
    consume: (value: string | null) =>
      value === null || value === undefined ? [] : (value.split(',') as NutritionMealType[]),
  })
  declare mealTypes: NutritionMealType[]

  @column()
  declare chatgptFoodId: number | null

  @computed()
  get source(): 'meal' | 'chatgptMeal' {
    if (this.foodId) {
      return 'meal'
    }
    return 'chatgptMeal'
  }

  @belongsTo(() => Athlete, { foreignKey: 'athleteId' })
  declare athlete: BelongsTo<typeof Athlete>

  @belongsTo(() => Aliment, { foreignKey: 'foodId' })
  declare food: BelongsTo<typeof Aliment>

  @belongsTo(() => ChatGPTNutrition, { foreignKey: 'chatgptFoodId' })
  declare chatgptFood: BelongsTo<typeof ChatGPTNutrition>
}
