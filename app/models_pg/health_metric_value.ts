import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import HealthMetric from '#models_pg/health_metric'
import Health from '#models_pg/health_rating'

export default class HealthMetricValue extends BaseModel {
  @column({ isPrimary: true })
  declare id: string

  @column()
  declare healthId: string

  @column()
  declare metricId: string

  @column()
  declare value: string

  @belongsTo(() => Health, { foreignKey: 'healthId' })
  declare health: BelongsTo<typeof Health>

  @belongsTo(() => HealthMetric, {
    foreignKey: 'metricId',
  })
  declare metric: BelongsTo<typeof HealthMetric>

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime
}
