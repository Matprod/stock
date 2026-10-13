import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Aliment from '#models_pg/aliment'
import Recipe from '#models_pg/recipe'

export default class RecipeAliment extends BaseModel {
  @column({ isPrimary: true })
  declare id: string

  @column()
  declare quantity: number

  @column()
  declare portion: number | null

  @column()
  declare mealId: string

  @belongsTo(() => Aliment)
  declare meal: BelongsTo<typeof Aliment>

  @column()
  declare recipeId: string | null

  @belongsTo(() => Recipe)
  declare recipe: BelongsTo<typeof Recipe>

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime
}
