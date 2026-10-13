import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import type { SportActivityMetricSource } from '#constants/sport_activity_metrics.constants'
import SportActivity from '#models_pg/sport_activity'
import SportActivityMetric from '#models_pg/sport_activity_metric'

export default class SportActivityMetricValue extends BaseModel {
  static table = 'sport_activity_metric_values'

  @column({ isPrimary: true })
  declare id: string

  @column()
  declare sportActivityId: string

  @column()
  declare metricId: string

  @column()
  declare source: SportActivityMetricSource

  @column()
  declare value: string

  @belongsTo(() => SportActivity)
  declare sportActivity: BelongsTo<typeof SportActivity>

  @belongsTo(() => SportActivityMetric, {
    foreignKey: 'metricId',
  })
  declare metric: BelongsTo<typeof SportActivityMetric>

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime
}
