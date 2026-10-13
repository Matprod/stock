import { BaseModel, belongsTo, column, hasMany, manyToMany } from '@adonisjs/lucid/orm'
import type { BelongsTo, HasMany, ManyToMany } from '@adonisjs/lucid/types/relations'
import Exercice from '#models/exercice'
import { DateTime } from 'luxon'
import Club from './club.js'
import WorkoutSessionInstance from '#models/workout_session_instance'

export default class WorkoutSession extends BaseModel {
  public static table = 'workout_sessions'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare name: string

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @column()
  declare clubId: number

  @belongsTo(() => Club)
  declare club: BelongsTo<typeof Club>

  @manyToMany(() => Exercice, {
    pivotTable: 'exercice_workout_session',
  })
  declare exercises: ManyToMany<typeof Exercice>

  @hasMany(() => WorkoutSessionInstance)
  declare instances: HasMany<typeof WorkoutSessionInstance>

  @column()
  declare duration: number | null
}
