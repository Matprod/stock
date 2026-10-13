import { BaseModel, column, hasMany } from '@adonisjs/lucid/orm'
import type { HasMany } from '@adonisjs/lucid/types/relations'
import ReinforcementExercise from '#models_pg/reinforcement_exercise'
import ActivityDisplayVariable from '#models_pg/activity_display_variable'

export default class Activity extends BaseModel {
  @column({ isPrimary: true })
  declare id: string

  @column()
  declare name: string

  @hasMany(() => ReinforcementExercise)
  declare exercices: HasMany<typeof ReinforcementExercise>

  @hasMany(() => ActivityDisplayVariable)
  declare activityDisplayVariables: HasMany<typeof ActivityDisplayVariable>
}
