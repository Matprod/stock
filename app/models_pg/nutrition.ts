import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo, computed } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Aliment from '#models_pg/aliment'
import Recipe from '#models_pg/recipe'
import Day from '#models_pg/day'
import LlmAliment from '#models_pg/llm_aliment'

export default class Nutrition extends BaseModel {
  @column({ isPrimary: true })
  declare id: string

  @column()
  declare mealType: string | null

  @column()
  declare quantity: number

  @column()
  declare portion: number | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @computed()
  get mealName(): string | null {
    if (this.aliment) {
      return this.aliment.name || null
    } else if (this.llmAliment) {
      return this.llmAliment.name || null
    } else if (this.recipe) {
      return this.recipe.name || null
    }
    return null
  }

  // Relations
  @column()
  declare dayId: string

  @belongsTo(() => Day)
  declare day: BelongsTo<typeof Day>

  @column()
  declare alimentId: string | null

  @belongsTo(() => Aliment)
  declare aliment: BelongsTo<typeof Aliment>

  @column()
  declare recipeId: string | null

  @belongsTo(() => Recipe)
  declare recipe: BelongsTo<typeof Recipe>

  @column()
  declare llmAlimentId: string | null

  @belongsTo(() => LlmAliment)
  declare llmAliment: BelongsTo<typeof LlmAliment>
}
