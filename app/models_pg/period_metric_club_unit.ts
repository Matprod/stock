import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Club from '#models_pg/club'
import PeriodMetric from '#models_pg/period_metric'

export default class PeriodMetricClubUnit extends BaseModel {
  @column({ isPrimary: true })
  declare id: string

  @column()
  declare metricId: string

  @column()
  declare clubId: string

  @column()
  declare unit: string

  @belongsTo(() => PeriodMetric, { foreignKey: 'metricId' })
  declare metric: BelongsTo<typeof PeriodMetric>

  @belongsTo(() => Club)
  declare club: BelongsTo<typeof Club>

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime
}
