import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column, hasMany } from '@adonisjs/lucid/orm'
import SportActivity from '#models_pg/sport_activity'
import type { BelongsTo, HasMany } from '@adonisjs/lucid/types/relations'
import DataProcessedMetricValue from '#models_pg/data_processed_metric_value'
import PeriodMetricValue from '#models_pg/period_metric_value'
import Serie from '#models_pg/serie'

export default class Period extends BaseModel {
  @column({ isPrimary: true })
  declare id: string

  @column()
  declare providerId: string | null

  @column()
  declare name: string | null

  @column.dateTime()
  declare startTime: DateTime | null

  @column.dateTime()
  declare endTime: DateTime | null

  @column()
  declare sportActivityId: string

  @column()
  declare needsReview: boolean

  @belongsTo(() => SportActivity)
  declare sportActivity: BelongsTo<typeof SportActivity>

  @hasMany(() => PeriodMetricValue, { foreignKey: 'periodId' })
  declare metricValues: HasMany<typeof PeriodMetricValue>

  @hasMany(() => DataProcessedMetricValue, { foreignKey: 'periodId' })
  declare dataProcessedMetricValues: HasMany<typeof DataProcessedMetricValue>

  @hasMany(() => Serie, { foreignKey: 'periodId' })
  declare series: HasMany<typeof Serie>

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime
}
