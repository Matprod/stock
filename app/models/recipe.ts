import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo, hasMany } from '@adonisjs/lucid/orm'
import type { BelongsTo, HasMany } from '@adonisjs/lucid/types/relations'
import Athlete from '#models/athlete'
import RecipeMeal from '#models/recipe_meal'
import { NutritionMealType } from '#constants/nutrition.constants'

export default class Recipe extends BaseModel {
  public static table = 'nutrition_recipe'

  @column({ isPrimary: true })
  declare id: number

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
  declare dateAdded: DateTime | null

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare dateUpdated: DateTime

  // Relations
  @column()
  declare athleteId: number

  @belongsTo(() => Athlete)
  declare athlete: BelongsTo<typeof Athlete>

  @hasMany(() => RecipeMeal)
  declare recipeMeals: HasMany<typeof RecipeMeal>
}
