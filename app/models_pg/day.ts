import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo, hasMany, hasOne, computed } from '@adonisjs/lucid/orm'
import type { BelongsTo, HasMany, HasOne } from '@adonisjs/lucid/types/relations'
import Athlete from '#models_pg/athlete'
import SportActivity from '#models_pg/sport_activity'
import Sleep from '#models_pg/sleep'
import Health from '#models_pg/health_rating'
import Nutrition from '#models_pg/nutrition'
import FeatureImportance from '#models_pg/feature_importance'
import BodymetricsHistory from '#models_pg/bodymetrics_history'
import DayMetricValue from '#models_pg/day_metric_value'

export default class Day extends BaseModel {
  @column({ isPrimary: true })
  declare id: string

  @column()
  declare athleteId: string

  @column.date()
  declare dateOfDay: DateTime

  @column()
  declare performanceScore: number | null

  @column()
  declare performanceScoreTest: number | null

  @column()
  declare injuryRiskScore: number | null

  @belongsTo(() => Athlete)
  declare athlete: BelongsTo<typeof Athlete>

  @hasMany(() => SportActivity)
  declare sportActivities: HasMany<typeof SportActivity>

  @hasMany(() => Sleep)
  declare sleeps: HasMany<typeof Sleep>

  @hasOne(() => Health)
  declare health: HasOne<typeof Health>

  @hasMany(() => Nutrition)
  declare nutrition: HasMany<typeof Nutrition>

  @hasMany(() => FeatureImportance)
  declare featureImportances: HasMany<typeof FeatureImportance>

  @hasMany(() => BodymetricsHistory)
  declare bodymetricsHistories: HasMany<typeof BodymetricsHistory>

  @hasMany(() => DayMetricValue)
  declare metricValues: HasMany<typeof DayMetricValue>

  @computed()
  get weight(): number | null {
    if (this.bodymetricsHistories && this.bodymetricsHistories.length > 0) {
      return this.bodymetricsHistories[0].weight
    }

    return null
  }
}
