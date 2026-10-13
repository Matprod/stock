import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo, hasMany } from '@adonisjs/lucid/orm'
import Day from '#models/day'
import type { BelongsTo, HasMany } from '@adonisjs/lucid/types/relations'
import HealthPain from '#models/health_pain'
import HealthRating from '#models/health_rating'
import Travel from '#models/travel'
import HealthMetricValue from '#models/health_metric_value'

export default class Health extends BaseModel {
  public static table = 'health_health'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare energyRating: number | null

  @column()
  declare bodySorenessRating: number | null

  @column()
  declare moodRating: number | null

  @column()
  declare stressRating: number | null

  @column()
  declare period: boolean | null

  @column()
  declare numberOfCigarettes: number | null

  @column()
  declare averagedHeartRate: number | null

  @column()
  declare weight: string | null

  @column.dateTime()
  declare dateAdded: DateTime | null

  @column.dateTime()
  declare dateUpdated: DateTime | null

  @column()
  declare heartRateVariability: number | null

  @column()
  declare restingHeartRate: number | null

  @column()
  declare travel: boolean | null

  @column()
  declare recoveryScore: number | null

  // Relations
  @column()
  declare athleteDayId: number

  @belongsTo(() => Day, {
    foreignKey: 'athleteDayId',
  })
  declare day: BelongsTo<typeof Day>

  @hasMany(() => HealthPain)
  declare pains: HasMany<typeof HealthPain>

  @hasMany(() => HealthRating, {
    foreignKey: 'healthId',
  })
  declare ratings: HasMany<typeof HealthRating>

  @hasMany(() => Travel, {
    foreignKey: 'healthId',
  })
  declare travels: HasMany<typeof Travel>

  @hasMany(() => HealthMetricValue)
  declare metricValues: HasMany<typeof HealthMetricValue>
}
