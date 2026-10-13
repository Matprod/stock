import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo, computed } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Aliment from '#models/aliment'
import Recipe from '#models/recipe'
import Day from '#models/day'
import ChatGPTNutrition from '#models/chatgpt_nutrition'

export default class Nutrition extends BaseModel {
  public static table = 'nutrition_nutrition'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare mealType: string | null

  @column.dateTime({ autoCreate: true })
  declare dateAdded: DateTime | null

  @column()
  declare quantity: number

  @column()
  declare portion: number | null

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare dateUpdated: DateTime

  @computed()
  get mealName(): string | null {
    if (this.meal) {
      return this.meal.alimNomEng || this.meal.alimNomFr || null
    } else if (this.chatgptMeal) {
      return this.chatgptMeal.name || this.chatgptMeal.nameFr || null
    } else if (this.recipe) {
      return this.recipe.name || null
    }
    return null
  }

  // Relations
  @column()
  declare athleteDayId: number

  @belongsTo(() => Day, {
    foreignKey: 'athleteDayId',
  })
  declare day: BelongsTo<typeof Day>

  @column()
  declare mealId: number | null

  @belongsTo(() => Aliment, {
    foreignKey: 'mealId',
  })
  declare meal: BelongsTo<typeof Aliment>

  @column()
  declare recipeId: number | null

  @belongsTo(() => Recipe)
  declare recipe: BelongsTo<typeof Recipe>

  @column({ columnName: 'chatgpt_meal_id' })
  declare chatgptMealId: number | null

  @belongsTo(() => ChatGPTNutrition, {
    foreignKey: 'chatgptMealId',
  })
  declare chatgptMeal: BelongsTo<typeof ChatGPTNutrition>
}
