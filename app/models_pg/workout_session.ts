import { BaseModel, belongsTo, column, hasMany, manyToMany } from '@adonisjs/lucid/orm'
import type { BelongsTo, HasMany, ManyToMany } from '@adonisjs/lucid/types/relations'
import ReinforcementExercise from '#models_pg/reinforcement_exercise'
import { DateTime } from 'luxon'
import Club from '#models_pg/club'
import WorkoutSessionInstance from '#models_pg/workout_session_instance'

export default class WorkoutSession extends BaseModel {
  @column({ isPrimary: true })
  declare id: string

  @column()
  declare name: string

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @column()
  declare clubId: string

  @belongsTo(() => Club)
  declare club: BelongsTo<typeof Club>

  @manyToMany(() => ReinforcementExercise, {
    pivotTable: 'workout_session_exercises',
    pivotForeignKey: 'workout_session_id',
    pivotRelatedForeignKey: 'reinforcement_exercise_id',
  })
  declare exercises: ManyToMany<typeof ReinforcementExercise>

  @hasMany(() => WorkoutSessionInstance)
  declare instances: HasMany<typeof WorkoutSessionInstance>

  @column()
  declare durationSeconds: number | null
}
