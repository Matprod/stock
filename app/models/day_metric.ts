import { DateTime } from 'luxon'
import { BaseModel, column, hasMany } from '@adonisjs/lucid/orm'
import type { MetricDataType } from '#constants/metrics.constants'
import DayMetricValue from '#models/day_metric_value'
import type { HasMany } from '@adonisjs/lucid/types/relations'

export default class DayMetric extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare name: string

  @column()
  declare description: string | null

  @column()
  declare unit: string

  @column()
  declare dataType: MetricDataType

  @hasMany(() => DayMetricValue)
  declare values: HasMany<typeof DayMetricValue>

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime
}
