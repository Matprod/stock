import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import PeriodMetric from '#models_pg/period_metric'
import Period from '#models_pg/period'

export default class DataProcessedMetricValue extends BaseModel {
  @column({ isPrimary: true })
  declare id: string

  @column()
  declare periodId: string

  @column()
  declare metricId: string

  @column()
  declare value: string

  @belongsTo(() => Period)
  declare period: BelongsTo<typeof Period>

  @belongsTo(() => PeriodMetric, {
    foreignKey: 'metricId',
  })
  declare metric: BelongsTo<typeof PeriodMetric>

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime
}
