import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Exercice from '#models/exercice'
import SportActivity from '#models/sport_activity'
import WorkoutSessionInstance from './workout_session_instance.js'

export default class SportActivityExerciseSet extends BaseModel {
  public static table = 'sportactivity_exerciseset'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare reps: number | null

  @column()
  declare weight: number | null

  @column()
  declare time: string | null

  @column()
  declare order: number | null

  @column()
  declare setOrder: number | null

  @column.dateTime({ autoCreate: true })
  declare dateAdded: DateTime | null

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare dateUpdated: DateTime

  @column()
  declare exerciseId: number

  @column()
  declare sportActivityId: number | null

  @column()
  declare workoutSessionInstanceId: number | null

  // RELATIONS

  @belongsTo(() => Exercice, {
    foreignKey: 'exerciseId',
  })
  declare exercise: BelongsTo<typeof Exercice> | null

  @belongsTo(() => SportActivity, {
    foreignKey: 'sportActivityId',
  })
  declare sportActivity: BelongsTo<typeof SportActivity>

  @belongsTo(() => WorkoutSessionInstance)
  declare workoutSessionInstance: BelongsTo<typeof WorkoutSessionInstance>
}
