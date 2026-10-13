import { BaseModel, belongsTo, column } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import WorkoutSession from '#models_pg/workout_session'
import ReinforcementExercises from '#models_pg/reinforcement_exercise'

export default class WorkoutSessionExercice extends BaseModel {
  @column({ isPrimary: true })
  declare id: string

  @column()
  declare workoutSessionId: string

  @column()
  declare reinforcementExerciseId: string

  @belongsTo(() => WorkoutSession)
  declare workoutSession: BelongsTo<typeof WorkoutSession>

  @belongsTo(() => ReinforcementExercises)
  declare reinforcementExercise: BelongsTo<typeof ReinforcementExercises>
}
