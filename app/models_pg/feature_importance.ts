import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column } from '@adonisjs/lucid/orm'
import Insight from '#models_pg/insight'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Day from '#models_pg/day'
import type { EntityType } from '#contracts/summary'
import type { PredictionType } from '#constants/insight.constants'

export default class FeatureImportance extends BaseModel {
  @column({ isPrimary: true })
  declare id: string

  @column()
  declare value: number

  @column()
  declare optimal: number | null

  @column()
  declare shapValue: number | null

  @column()
  declare contribPct: number | null

  @column()
  declare type: EntityType

  @column()
  declare category: PredictionType

  @column()
  declare insightId: string

  @belongsTo(() => Insight)
  declare insight: BelongsTo<typeof Insight>

  @column()
  declare dayId: string

  @belongsTo(() => Day)
  declare day: BelongsTo<typeof Day>

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime
}
