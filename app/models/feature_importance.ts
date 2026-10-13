import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column } from '@adonisjs/lucid/orm'
import Insight from '#models/insight'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Day from '#models/day'

export default class FeatureImportance extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare value: number

  @column()
  declare optimal: number | null

  @column()
  declare shapValue: number | null

  @column()
  declare contribPct: number | null

  @column()
  declare type: 'activity' | 'nutrition' | 'sleep' | 'health'

  @column()
  declare category: 'performance' | 'injury'

  @column()
  declare insightId: number

  @belongsTo(() => Insight)
  declare insight: BelongsTo<typeof Insight>

  @column()
  declare dayId: number

  @belongsTo(() => Day)
  declare day: BelongsTo<typeof Day>

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime
}
