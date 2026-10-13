import { DateTime } from 'luxon'
import { BaseModel, column, hasMany } from '@adonisjs/lucid/orm'
import type { MetricAggregationMethod, MetricDataType } from '#constants/metrics.constants'
import DataProcessedMetricValue from '#models_pg/data_processed_metric_value'
import PeriodMetricClubUnit from '#models_pg/period_metric_club_unit'
import PeriodMetricValue from '#models_pg/period_metric_value'
import type { HasMany } from '@adonisjs/lucid/types/relations'

export default class PeriodMetric extends BaseModel {
  @column({ isPrimary: true })
  declare id: string

  @column()
  declare name: string

  @column()
  declare displayName: string | null

  @column()
  declare description: string | null

  @column()
  declare unit: string | null

  @column()
  declare aggregationMethod: MetricAggregationMethod | null

  @column()
  declare dataType: MetricDataType

  @hasMany(() => PeriodMetricValue, { foreignKey: 'metricId' })
  declare values: HasMany<typeof PeriodMetricValue>

  @hasMany(() => PeriodMetricClubUnit, { foreignKey: 'metricId' })
  declare clubUnits: HasMany<typeof PeriodMetricClubUnit>

  @hasMany(() => DataProcessedMetricValue, { foreignKey: 'metricId' })
  declare processedValues: HasMany<typeof DataProcessedMetricValue>

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime
}
