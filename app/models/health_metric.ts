import { DateTime } from 'luxon'
import { BaseModel, column, hasMany } from '@adonisjs/lucid/orm'
import type { MetricDataType } from '#constants/metrics.constants'
import HealthMetricValue from '#models/health_metric_value'
import type { HasMany } from '@adonisjs/lucid/types/relations'

export default class HealthMetric extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare name: string

  @column()
  declare description: string

  @column()
  declare unit: string

  @column()
  declare dataType: MetricDataType

  @hasMany(() => HealthMetricValue)
  declare values: HasMany<typeof HealthMetricValue>

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime
}
