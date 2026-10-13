import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo, computed } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Athlete from '#models_pg/athlete'
import Aliment from '#models_pg/aliment'
import LlmAliment from '#models_pg/llm_aliment'
import { NutritionMealType } from '#constants/nutrition.constants'

export default class FavoriteAliment extends BaseModel {
  @column({ isPrimary: true })
  declare id: string

  @column()
  declare athleteId: string

  @column()
  declare alimentId: string | null

  @column()
  declare llmAlimentId: string | null

  @column()
  declare mealTypes: NutritionMealType[]

  @computed()
  get source(): 'aliment' | 'llm_aliment' {
    if (this.alimentId) {
      return 'aliment'
    }
    return 'llm_aliment'
  }

  @belongsTo(() => Athlete)
  declare athlete: BelongsTo<typeof Athlete>

  @belongsTo(() => Aliment)
  declare aliment: BelongsTo<typeof Aliment>

  @belongsTo(() => LlmAliment)
  declare llmAliment: BelongsTo<typeof LlmAliment>

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime
}
