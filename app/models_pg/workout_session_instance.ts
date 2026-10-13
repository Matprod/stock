import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column, hasMany } from '@adonisjs/lucid/orm'
import type { BelongsTo, HasMany } from '@adonisjs/lucid/types/relations'
import WorkoutSession from '#models_pg/workout_session'
import SportActivityExerciseSet from '#models_pg/exercise_set'
import SportActivity from '#models_pg/sport_activity'

export default class WorkoutSessionInstance extends BaseModel {
  @column({ isPrimary: true })
  declare id: string

  @column.dateTime()
  declare startTime: DateTime

  @column()
  declare durationSeconds: number | null

  @column()
  declare title: string

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @column()
  declare workoutSessionId: string

  @belongsTo(() => WorkoutSession)
  declare workoutSession: BelongsTo<typeof WorkoutSession>

  @hasMany(() => SportActivityExerciseSet)
  declare exercises: HasMany<typeof SportActivityExerciseSet>

  @hasMany(() => SportActivity)
  declare sportActivities: HasMany<typeof SportActivity>
}
