import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import ReinforcementExercise from '#models_pg/reinforcement_exercise'
import SportActivity from '#models_pg/sport_activity'
import WorkoutSessionInstance from './workout_session_instance.js'

export default class ExerciseSet extends BaseModel {
  @column({ isPrimary: true })
  declare id: string

  @column()
  declare reps: number | null

  @column()
  declare weight: number | null

  @column()
  declare durationSeconds: number | null

  @column()
  declare order: number | null

  @column()
  declare setOrder: number | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @column()
  declare exerciseId: string

  @column()
  declare sportActivityId: string | null

  @column()
  declare workoutSessionInstanceId: string | null

  // RELATIONS

  @belongsTo(() => ReinforcementExercise, {
    foreignKey: 'exerciseId',
  })
  declare exercise: BelongsTo<typeof ReinforcementExercise> | null

  @belongsTo(() => SportActivity)
  declare sportActivity: BelongsTo<typeof SportActivity>

  @belongsTo(() => WorkoutSessionInstance)
  declare workoutSessionInstance: BelongsTo<typeof WorkoutSessionInstance>
}
