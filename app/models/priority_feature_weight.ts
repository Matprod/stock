import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Club from '#models/club'
import Insight from '#models/insight'

export default class PriorityFeatureWeight extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare clubId: number | null

  @column()
  declare insightId: number

  @column()
  declare type: 'performance' | 'injury'

  @column()
  declare weight: number

  @belongsTo(() => Club, {
    foreignKey: 'clubId',
  })
  declare club: BelongsTo<typeof Club> | null

  @belongsTo(() => Insight)
  declare insight: BelongsTo<typeof Insight>

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime
}

