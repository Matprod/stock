import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import User from '#models/user'
import Exercice from '#models/exercice'

export default class WorkoutExerciseFavorite extends BaseModel {
  public static table = 'reinforcement_exercise_favorites'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare userId: number

  @column()
  declare exerciseId: number

  @belongsTo(() => User)
  declare user: BelongsTo<typeof User>

  @belongsTo(() => Exercice)
  declare exercise: BelongsTo<typeof Exercice>

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime
}
