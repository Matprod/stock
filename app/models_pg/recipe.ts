import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo, hasMany } from '@adonisjs/lucid/orm'
import type { BelongsTo, HasMany } from '@adonisjs/lucid/types/relations'
import Athlete from '#models_pg/athlete'
import RecipeAliment from '#models_pg/recipe_aliment'
import { NutritionMealType } from '#constants/nutrition.constants'

export default class Recipe extends BaseModel {
  @column({ isPrimary: true })
  declare id: string

  @column()
  declare name: string

  @column({
    prepare: (value: NutritionMealType[] | null) =>
      value === null || value === undefined ? null : value.join(','),
    consume: (value: string | null) =>
      value === null || value === undefined ? [] : (value.split(',') as NutritionMealType[]),
  })
  declare mealType: NutritionMealType[]

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  // Relations
  @column()
  declare athleteId: string

  @belongsTo(() => Athlete)
  declare athlete: BelongsTo<typeof Athlete>

  @hasMany(() => RecipeAliment)
  declare recipeAliments: HasMany<typeof RecipeAliment>
}
