import { DateTime } from 'luxon'
import { BaseModel, column, hasMany } from '@adonisjs/lucid/orm'
import type { MetricAggregationMethod, MetricDataType } from '#constants/metrics.constants'
import PeriodMetricValue from '#models/period_metric_value'
import type { HasMany } from '@adonisjs/lucid/types/relations'

export default class PeriodMetric extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare name: string

  @column()
  declare description: string | null

  @column()
  declare unit: string

  @column()
  declare aggregationMethod: MetricAggregationMethod | null

  @column()
  declare dataType: MetricDataType

  @hasMany(() => PeriodMetricValue)
  declare values: HasMany<typeof PeriodMetricValue>

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime
}
