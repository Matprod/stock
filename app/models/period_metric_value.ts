import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import PeriodMetric from '#models/period_metric'
import Period from '#models/period'

export default class PeriodMetricValue extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare periodId: number

  @column()
  declare metricId: number

  @column()
  declare value: string

  @belongsTo(() => Period, {
    foreignKey: 'periodId',
    localKey: 'id',
  })
  declare period: BelongsTo<typeof Period>

  @belongsTo(() => PeriodMetric, {
    foreignKey: 'metricId',
    localKey: 'id',
  })
  declare metric: BelongsTo<typeof PeriodMetric>

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime
}
