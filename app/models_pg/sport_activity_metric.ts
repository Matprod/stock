import { DateTime } from 'luxon'
import { BaseModel, column, hasMany } from '@adonisjs/lucid/orm'
import type { MetricAggregationMethod, MetricDataType } from '#constants/metrics.constants'
import SportActivityMetricValue from '#models_pg/sport_activity_metric_value'
import type { HasMany } from '@adonisjs/lucid/types/relations'

export default class SportActivityMetric extends BaseModel {
  static table = 'sport_activity_metrics'

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
  declare aggregationMethod: MetricAggregationMethod

  @column()
  declare dataType: MetricDataType

  @hasMany(() => SportActivityMetricValue, { foreignKey: 'metricId' })
  declare values: HasMany<typeof SportActivityMetricValue>

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime
}
