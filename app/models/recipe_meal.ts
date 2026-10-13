import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Aliment from '#models/aliment'
import Recipe from '#models/recipe'

export default class RecipeMeal extends BaseModel {
  public static table = 'nutrition_recipemeal'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare quantity: number

  @column()
  declare portion: number | null

  @column()
  declare mealId: number

  @belongsTo(() => Aliment, {
    foreignKey: 'mealId',
  })
  declare meal: BelongsTo<typeof Aliment>

  @column()
  declare recipeId: number | null

  @belongsTo(() => Recipe)
  declare recipe: BelongsTo<typeof Recipe>

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare dateUpdated: DateTime
}
