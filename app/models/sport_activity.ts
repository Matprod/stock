import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column, computed, hasMany } from '@adonisjs/lucid/orm'
import Day from '#models/day'
import type { BelongsTo, HasMany } from '@adonisjs/lucid/types/relations'
import Activity from '#models/activity'
import SportActivityPain from '#models/sport_activity_pain'
import FoodIntake from '#models/food_intake'
import SportActivityExerciseSet from '#models/sport_activity_exercise_set'
import WorkoutSessionInstance from '#models/workout_session_instance'
import type { DataSource } from '#contracts/sport_activity'
import Period from '#models/period'
import Event from '#models/event'

export default class SportActivity extends BaseModel {
  public static table = 'sportactivity_sportactivity'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare activityName: string | null

  @column()
  declare dataSource: DataSource

  @column()
  declare distance: number | null

  @column()
  declare speed: string | null

  @column()
  declare duration: number | null

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

  @column.dateTime()
  declare dateAdded: DateTime | null

  @column()
  declare fatigueLevel: number | null

  @column()
  declare pleasureLevel: number | null

  @column()
  declare activeCalories: number | null

  @column()
  declare deviceName: string | null

  @column()
  declare cadence: number | null

  @column()
  declare elevationDescent: number | null

  @column.dateTime()
  declare dateUpdated: DateTime | null

  @column()
  declare hasChanged: boolean | null

  @column()
  declare trainingLoad: number | null

  @column({
    consume: (value) => (value === null || value === undefined ? null : Boolean(value)),
    prepare: (value: boolean | null) =>
      value === null || value === undefined ? null : value ? 1 : 0,
  })
  declare gameActivity: boolean | null

  @column()
  declare strain: number | null

  // MyCoach specific metrics
  @column({
    columnName: 'distance_0_7_kmh',
    consume: (value) => (value ? parseFloat(value) : null),
  })
  declare distance0To7Kmh: number | null

  @column({
    columnName: 'distance_7_14_kmh',
    consume: (value) => (value ? parseFloat(value) : null),
  })
  declare distance7To14Kmh: number | null

  @column({
    columnName: 'distance_14_19_kmh',
    consume: (value) => (value ? parseFloat(value) : null),
  })
  declare distance14To19Kmh: number | null

  @column({
    columnName: 'distance_19_25_kmh',
    consume: (value) => (value ? parseFloat(value) : null),
  })
  declare distance19To25Kmh: number | null

  @column({
    columnName: 'distance_25_plus_kmh',
    consume: (value) => (value ? parseFloat(value) : null),
  })
  declare distance25PlusKmh: number | null

  @column({ columnName: 'nb_efforts_above_19_8_kmh' })
  declare nbEffortsAbove19_8Kmh: number | null

  @column({ columnName: 'nb_efforts_above_25_kmh' })
  declare nbEffortsAbove25Kmh: number | null

  @column({ columnName: 'top_speed', consume: (value) => (value ? parseFloat(value) : null) })
  declare topSpeed: number | null

  @column({ columnName: 'event_type' })
  declare eventType: string | null

  @column({
    columnName: 'vmax_acceleration',
    consume: (value) => (value ? parseFloat(value) : null),
  })
  declare vmaxAcceleration: number | null

  @column({
    columnName: 'vmax_deceleration',
    consume: (value) => (value ? parseFloat(value) : null),
  })
  declare vmaxDeceleration: number | null

  @column({ columnName: 'nb_decelerations_above_3ms2' })
  declare nbDecelerationsAbove3ms2: number | null

  @column({ columnName: 'nb_accelerations_above_3ms2' })
  declare nbAccelerationsAbove3ms2: number | null

  @column()
  declare energyConsumptionCarbs: number | null

  @column()
  declare energyConsumptionFats: number | null

  @column()
  declare epocFinal: number | null

  @column()
  declare epocPeak: number | null

  @column()
  declare hfAverage: number | null

  @column()
  declare lfAverage: number | null

  @column()
  declare lfHfRatio: number | null

  @column()
  declare rmssd: number | null

  @column()
  declare trimp: number | null

  @column()
  declare movementLoad: number | null

  @column({ columnName: 'zone1_time' })
  declare zone1Time: number | null

  @column({ columnName: 'zone2_time' })
  declare zone2Time: number | null

  @column({ columnName: 'zone3_time' })
  declare zone3Time: number | null

  @column({ columnName: 'zone4_time' })
  declare zone4Time: number | null

  @column({ columnName: 'zone5_time' })
  declare zone5Time: number | null

  @column()
  declare fcMax: number | null

  // Military/Parachute specific metrics
  @column()
  declare carriedWeight: number | null

  @column()
  declare weaponWeight: number | null

  @column()
  declare burstCount: number | null

  @column()
  declare heartExertion: number | null

  @column()
  declare groundImpact: number | null // m/s²

  @column()
  declare descentDuration: string | null

  @column()
  declare averageDescentSpeed: number | null // m/s

  @column()
  declare freefallDuration: string | null

  @column()
  declare maxFreefallSpeed: number | null // m/s

  @column()
  declare canopyDuration: string | null

  @computed()
  get durationInMinutes(): number | null {
    return this.duration ? this.duration / 60000000 : null
  }

  // RELATIONS

  @column()
  declare athleteDayId: number

  @belongsTo(() => Day, {
    foreignKey: 'athleteDayId',
  })
  declare athleteDay: BelongsTo<typeof Day>

  @column({ columnName: 'activity_type_id' })
  declare activity_type_id: number | null

  @belongsTo(() => Activity, {
    foreignKey: 'activity_type_id',
  })
  declare sport: BelongsTo<typeof Activity>

  @hasMany(() => SportActivityPain)
  declare sportActivityPains: HasMany<typeof SportActivityPain>

  @hasMany(() => FoodIntake)
  declare foodIntakes: HasMany<typeof FoodIntake>

  @column()
  declare workoutSessionInstanceId: number | null

  @belongsTo(() => WorkoutSessionInstance)
  declare workoutSessionInstance: BelongsTo<typeof WorkoutSessionInstance>

  @hasMany(() => Period)
  declare periods: HasMany<typeof Period>

  @hasMany(() => SportActivityExerciseSet, {
    foreignKey: 'sportActivityId',
  })
  declare exerciseSets: HasMany<typeof SportActivityExerciseSet>

  @column()
  declare eventId: number | null

  @belongsTo(() => Event, {
    foreignKey: 'eventId',
  })
  declare event: BelongsTo<typeof Event>
}
