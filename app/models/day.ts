import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo, hasMany, hasOne, computed } from '@adonisjs/lucid/orm'
import type { BelongsTo, HasMany, HasOne } from '@adonisjs/lucid/types/relations'
import Athlete from '#models/athlete'
import SportActivity from '#models/sport_activity'
import DailyAverage from '#models/daily_average'
import Sleep from '#models/sleep'
import Health from '#models/health'
import Nutrition from '#models/nutrition'
import HealthExtra from '#models/health_extra'
import FeatureImportance from '#models/feature_importance'
import BodymetricsHistory from '#models/bodymetrics_history'
import NutritionMetricValue from '#models/nutrition_metric_value'
import DayMetricValue from '#models/day_metric_value'
import Medication from '#models/medication'

export default class Day extends BaseModel {
  public static table = 'base_athleteday'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare complete: boolean | null

  @column()
  declare performanceScore: number | null

  @column()
  declare healthScore: number | null

  @column()
  declare activityScore: number | null

  @column()
  declare sleepScore: number | null

  @column()
  declare performancePrediction: number | null

  @column()
  declare injuryScore: number | null

  @column()
  declare injuryHealthScore: number | null

  @column()
  declare injuryActivityScore: number | null

  @column()
  declare injurySleepScore: number | null

  @column.date()
  declare dateOfDay: DateTime | null

  // RELATIONS

  @column()
  declare athleteId: number

  @belongsTo(() => Athlete)
  declare athlete: BelongsTo<typeof Athlete>

  @hasMany(() => SportActivity, {
    foreignKey: 'athleteDayId',
  })
  declare sportActivities: HasMany<typeof SportActivity>

  @hasOne(() => DailyAverage, {
    foreignKey: 'athleteDayId',
  })
  declare dailyAverage: HasOne<typeof DailyAverage>

  @hasMany(() => Sleep, {
    foreignKey: 'athleteDayId',
  })
  declare sleeps: HasMany<typeof Sleep>

  @hasOne(() => Health, {
    foreignKey: 'athleteDayId',
  })
  declare health: HasOne<typeof Health>

  @hasMany(() => Nutrition, {
    foreignKey: 'athleteDayId',
  })
  declare nutrition: HasMany<typeof Nutrition>

  @hasOne(() => HealthExtra, {
    foreignKey: 'athleteDayId',
  })
  declare healthExtra: HasOne<typeof HealthExtra>

  @hasMany(() => FeatureImportance, {
    foreignKey: 'dayId',
  })
  declare featureImportances: HasMany<typeof FeatureImportance>

  @hasMany(() => BodymetricsHistory, { foreignKey: 'dayId' })
  declare bodymetricsHistories: HasMany<typeof BodymetricsHistory>

  @hasMany(() => NutritionMetricValue)
  declare nutritionMetricValues: HasMany<typeof NutritionMetricValue>

  @hasMany(() => DayMetricValue, {
    foreignKey: 'athleteDayId',
  })
  declare metricValues: HasMany<typeof DayMetricValue>

  @hasMany(() => Medication, {
    foreignKey: 'athleteDayId',
  })
  declare medications: HasMany<typeof Medication>

  @computed()
  get finalScore() {
    return this.performancePrediction ?? this.performanceScore
  }

  @computed()
  get healthFinalScore() {
    return this.healthScore
  }

  @computed()
  get activityFinalScore() {
    return this.activityScore
  }

  @computed()
  get sleepFinalScore() {
    return this.sleepScore
  }

  @computed()
  get weight(): number | null {
    if (this.bodymetricsHistories && this.bodymetricsHistories.length > 0) {
      return this.bodymetricsHistories[0].weight
    }

    return null
  }
}
