import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import SleepMetric from '#models/sleep_metric'
import Sleep from '#models/sleep'

export default class SleepMetricValue extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare sleepId: number

  @column()
  declare metricId: number

  @column()
  declare value: string

  @belongsTo(() => Sleep, {
    foreignKey: 'sleepId',
    localKey: 'id',
  })
  declare sleep: BelongsTo<typeof Sleep>

  @belongsTo(() => SleepMetric, {
    foreignKey: 'metricId',
    localKey: 'id',
  })
  declare metric: BelongsTo<typeof SleepMetric>

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime
}
