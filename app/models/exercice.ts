import { BaseModel, column, manyToMany, belongsTo, hasMany, computed } from '@adonisjs/lucid/orm'
import type { ManyToMany, BelongsTo, HasMany } from '@adonisjs/lucid/types/relations'
import WorkoutSession from '#models/workout_session'
import Activity from '#models/activity'
import Club from '#models/club'
import WorkoutExerciseFavorite from '#models/workout_exercise_favorite'
import { compose } from '@adonisjs/core/helpers'
import { SoftDeletes } from 'adonis-lucid-soft-deletes'
import { ExerciseDifficulty, ExerciseType } from '#constants/workout.constants'

export default class Exercice extends compose(BaseModel, SoftDeletes) {
  public static table = 'sportactivity_reinforcementexercices'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare nameFr: string | null

  @column()
  declare nameEn: string | null

  @column()
  declare videoLink: string | null

  @column()
  declare clubId: number | null

  @column()
  declare activityId: number | null

  @column()
  declare difficulty: ExerciseDifficulty | null

  @column()
  declare estimatedReps: number | null

  @column()
  declare estimatedDuration: number | null // en secondes

  @column()
  declare bodyweightPercentage: number | null

  @column()
  declare type: ExerciseType | null

  @computed()
  public get favorite(): boolean {
    return Boolean(this.$extras.favorite)
  }

  @belongsTo(() => Activity)
  declare activity: BelongsTo<typeof Activity>

  @belongsTo(() => Club)
  declare club: BelongsTo<typeof Club>

  @manyToMany(() => WorkoutSession, {
    pivotTable: 'exercice_workout_session',
  })
  declare workoutSessions: ManyToMany<typeof WorkoutSession>

  @hasMany(() => WorkoutExerciseFavorite, {
    foreignKey: 'exerciseId',
    serializeAs: null,
  })
  declare workoutExerciseFavorites: HasMany<typeof WorkoutExerciseFavorite>
}
