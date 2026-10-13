import { BaseModel, column, belongsTo, hasMany } from '@adonisjs/lucid/orm'
import Day from '#models_pg/day'
import type { BelongsTo, HasMany } from '@adonisjs/lucid/types/relations'
import HealthPain from '#models_pg/health_pain'
import Travel from '#models_pg/travel'
import HealthMetricValue from '#models_pg/health_metric_value'

export default class HealthRating extends BaseModel {
  @column({ isPrimary: true })
  declare id: string

  @column()
  declare energyRating: number | null

  @column()
  declare moodRating: number | null

  @column()
  declare stressRating: number | null

  @column()
  declare wellbeingRating: number | null

  @column()
  declare bodySorenessRating: number | null

  // Relations
  @column()
  declare dayId: string

  @belongsTo(() => Day)
  declare day: BelongsTo<typeof Day>

  @hasMany(() => HealthPain, { foreignKey: 'healthId' })
  declare pains: HasMany<typeof HealthPain>

  @hasMany(() => Travel, { foreignKey: 'healthId' })
  declare travels: HasMany<typeof Travel>

  @hasMany(() => HealthMetricValue, { foreignKey: 'healthId' })
  declare metricValues: HasMany<typeof HealthMetricValue>
}
