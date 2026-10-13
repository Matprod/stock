import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Club from '#models_pg/club'
import Insight from '#models_pg/insight'
import type { PredictionType } from '#constants/insight.constants'

export default class PriorityFeatureWeight extends BaseModel {
  @column({ isPrimary: true })
  declare id: string

  @column()
  declare clubId: string | null

  @column()
  declare insightId: string

  @column()
  declare type: PredictionType

  @column()
  declare weight: number

  @belongsTo(() => Club)
  declare club: BelongsTo<typeof Club> | null

  @belongsTo(() => Insight)
  declare insight: BelongsTo<typeof Insight>

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime
}
