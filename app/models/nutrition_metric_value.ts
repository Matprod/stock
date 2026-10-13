import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import NutritionMetric from '#models/nutrition_metric'
import Day from '#models/day'

export default class NutritionMetricValue extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare athleteDayId: number

  @column()
  declare metricId: number

  @column()
  declare value: string

  @belongsTo(() => Day, {
    foreignKey: 'athleteDayId',
    localKey: 'id',
  })
  declare day: BelongsTo<typeof Day>

  @belongsTo(() => NutritionMetric, {
    foreignKey: 'metricId',
    localKey: 'id',
  })
  declare metric: BelongsTo<typeof NutritionMetric>

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime
}
