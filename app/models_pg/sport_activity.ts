import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column, computed, hasMany } from '@adonisjs/lucid/orm'
import Day from '#models_pg/day'
import type { BelongsTo, HasMany } from '@adonisjs/lucid/types/relations'
import Activity from '#models_pg/activity'
import SportActivityPain from '#models_pg/sport_activity_pain'
import ActivityFoodIntake from '#models_pg/activity_food_intake'
import SportActivityExerciseSet from '#models_pg/exercise_set'
import WorkoutSessionInstance from '#models_pg/workout_session_instance'
import type { DataSource } from '#contracts/sport_activity'
import Period from '#models_pg/period'
import Event from '#models_pg/event'
import SportActivityMetricValue from '#models_pg/sport_activity_metric_value'

export default class SportActivity extends BaseModel {
  @column({ isPrimary: true })
  declare id: string

  @column()
  declare dataSource: DataSource

  @column()
  declare distance: number | null

  @column()
  declare speed: number | null

  @column()
  declare durationSeconds: number | null

  @column()
  declare elevation: number | null

  @column()
  declare power: number | null

  @column()
  declare averagedBpm: number | null

  @column()
  declare rpe: number | null

  @column()
  declare fitnessLevel: number | null

  @column()
  declare cardioRespiratory: number | null

  @column()
  declare muscularDifficulty: number | null

  @column()
  declare timeOfActivity: string | null

  @column()
  declare fatigueLevel: number | null

  @column()
  declare pleasureLevel: number | null

  @column()
  declare activeCalories: number | null

  @column()
  declare cadence: number | null

  @column()
  declare elevationDescent: number | null

  @column()
  declare trainingLoad: number | null

  @column({
    consume: (value) => (value === null || value === undefined ? null : Boolean(value)),
    prepare: (value: boolean | null) =>
      value === null || value === undefined ? null : value ? 1 : 0,
  })
  declare gameActivity: boolean | null

  @column()
  declare fcMax: number | null

  @column()
  declare activityName: string | null

  @column()
  declare sessionComment: string | null

  @column()
  declare needsReview: boolean

  @computed()
  get durationInMinutes(): number | null {
    return this.durationSeconds !== null && this.durationSeconds !== undefined
      ? Math.round(this.durationSeconds / 60)
      : null
  }

  @computed()
  get durationMinutes(): number {
    return this.durationInMinutes ?? 0
  }

  // RELATIONS

  @column()
  declare dayId: string

  @belongsTo(() => Day)
  declare day: BelongsTo<typeof Day>

  @column()
  declare activityTypeId: string | null

  @belongsTo(() => Activity, {
    foreignKey: 'activityTypeId',
  })
  declare sport: BelongsTo<typeof Activity>

  @hasMany(() => SportActivityPain)
  declare sportActivityPains: HasMany<typeof SportActivityPain>

  @hasMany(() => ActivityFoodIntake)
  declare activityFoodIntakes: HasMany<typeof ActivityFoodIntake>

  @column()
  declare workoutSessionInstanceId: string | null

  @belongsTo(() => WorkoutSessionInstance)
  declare workoutSessionInstance: BelongsTo<typeof WorkoutSessionInstance>

  @hasMany(() => Period)
  declare periods: HasMany<typeof Period>

  @hasMany(() => SportActivityMetricValue)
  declare metricValues: HasMany<typeof SportActivityMetricValue>

  @hasMany(() => SportActivityExerciseSet, {
    foreignKey: 'sportActivityId',
  })
  declare exerciseSets: HasMany<typeof SportActivityExerciseSet>

  @column()
  declare eventId: string | null

  @belongsTo(() => Event)
  declare event: BelongsTo<typeof Event>

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime
}
