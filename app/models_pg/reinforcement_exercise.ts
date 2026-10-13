import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column, hasMany } from '@adonisjs/lucid/orm'
import type { BelongsTo, HasMany } from '@adonisjs/lucid/types/relations'
import type { ExerciseDifficulty, ExerciseType } from '#constants/workout.constants'
import Club from '#models_pg/club'
import WorkoutExerciseFavorite from '#models_pg/workout_exercise_favorite'
import Activity from '#models_pg/activity'

export default class ReinforcementExercise extends BaseModel {
  @column({ isPrimary: true })
  declare id: string

  @column()
  declare name: string

  @column()
  declare type: ExerciseType

  @column()
  declare difficulty: ExerciseDifficulty

  @column()
  declare videoLink: string | null

  @column()
  declare estimatedReps: number | null

  @column()
  declare estimatedDuration: number | null

  @column()
  declare bodyweightPercentage: number | null

  @column()
  declare clubId: string | null

  @column()
  declare activityId: string

  @belongsTo(() => Activity)
  declare activity: BelongsTo<typeof Activity>

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @belongsTo(() => Club)
  declare club: BelongsTo<typeof Club>

  @hasMany(() => WorkoutExerciseFavorite, { foreignKey: 'exerciseId' })
  declare workoutExerciseFavorites: HasMany<typeof WorkoutExerciseFavorite>
}
