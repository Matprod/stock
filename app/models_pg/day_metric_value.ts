import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import DayMetric from '#models_pg/day_metric'
import Day from '#models_pg/day'

export default class DayMetricValue extends BaseModel {
  @column({ isPrimary: true })
  declare id: string

  @column()
  declare dayId: string

  @column()
  declare metricId: string

  @column()
  declare value: string

  @belongsTo(() => Day)
  declare day: BelongsTo<typeof Day>

  @belongsTo(() => DayMetric, {
    foreignKey: 'metricId',
  })
  declare metric: BelongsTo<typeof DayMetric>

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime
}
