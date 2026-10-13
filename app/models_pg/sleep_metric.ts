import { DateTime } from 'luxon'
import { BaseModel, column, hasMany } from '@adonisjs/lucid/orm'
import type { MetricDataType } from '#constants/metrics.constants'
import SleepMetricValue from '#models_pg/sleep_metric_value'
import type { HasMany } from '@adonisjs/lucid/types/relations'

export default class SleepMetric extends BaseModel {
  @column({ isPrimary: true })
  declare id: string

  @column()
  declare name: string

  @column()
  declare description: string | null

  @column()
  declare unit: string

  @column()
  declare dataType: MetricDataType

  @hasMany(() => SleepMetricValue)
  declare values: HasMany<typeof SleepMetricValue>

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime
}
