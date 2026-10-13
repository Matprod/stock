import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import HealthMetric from '#models/health_metric'
import Health from '#models/health'

export default class HealthMetricValue extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare healthId: number

  @column()
  declare metricId: number

  @column()
  declare value: string

  @belongsTo(() => Health, {
    foreignKey: 'healthId',
    localKey: 'id',
  })
  declare health: BelongsTo<typeof Health>

  @belongsTo(() => HealthMetric, {
    foreignKey: 'metricId',
    localKey: 'id',
  })
  declare metric: BelongsTo<typeof HealthMetric>

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime
}
