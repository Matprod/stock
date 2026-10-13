import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Club from '#models/club'
import Insight from '#models/insight'

export default class ClubInsight extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare clubId: number

  @column()
  declare insightId: number

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  // Relations
  @belongsTo(() => Club)
  declare club: BelongsTo<typeof Club>

  @belongsTo(() => Insight)
  declare insight: BelongsTo<typeof Insight>
}
