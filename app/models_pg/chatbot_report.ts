import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import type { PredictionType } from '#constants/insight.constants'
import Day from '#models_pg/day'

export default class ChatbotReport extends BaseModel {
  @column({ isPrimary: true })
  declare id: string

  @column()
  declare dayId: string

  @column()
  declare category: PredictionType

  @column()
  declare message: string

  @column()
  declare summary: string | null

  @column()
  declare scoreAtGeneration: number | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @belongsTo(() => Day)
  declare day: BelongsTo<typeof Day>

  public static async latestForDay(dayId: string, category: PredictionType) {
    return this.query()
      .where('dayId', dayId)
      .where('category', category)
      .orderBy('createdAt', 'desc')
      .first()
  }
}
