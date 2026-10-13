import { DateTime } from 'luxon'
import { BaseModel, column, hasMany } from '@adonisjs/lucid/orm'
import type { MetricDataType } from '#constants/metrics.constants'
import NutritionMetricValue from '#models/nutrition_metric_value'
import type { HasMany } from '@adonisjs/lucid/types/relations'

export default class NutritionMetric extends BaseModel {
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

  @hasMany(() => NutritionMetricValue)
  declare values: HasMany<typeof NutritionMetricValue>

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime
}
