import { BaseModel, column, hasMany } from '@adonisjs/lucid/orm'
import type { HasMany } from '@adonisjs/lucid/types/relations'
import Exercice from '#models/exercice'
import ActivityDisplayVariable from '#models/activity_display_variable'

export default class Activity extends BaseModel {
  public static table = 'base_activity'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare nameFr: string | null

  @column()
  declare nameEn: string | null

  @column()
  declare distance: boolean | null

  @column()
  declare distanceUnit: string | null

  @column()
  declare speed: boolean | null

  @column()
  declare speedUnit: string | null

  @column()
  declare duration: boolean | null

  @column()
  declare elevation: boolean | null

  @column()
  declare elevationUnit: string | null

  @column()
  declare gpsData: boolean | null

  @column()
  declare power: boolean | null

  @column()
  declare powerUnit: string | null

  @column()
  declare averagedBpm: boolean | null

  @column()
  declare rpe: boolean | null

  @column()
  declare trainingLoad: number | null

  @column()
  declare fitnessLevel: boolean | null

  @column()
  declare fatigueLevel: boolean | null

  @column()
  declare pleasureLevel: boolean | null

  @column()
  declare cardioRespiratory: boolean | null

  @column()
  declare muscularDifficulty: boolean | null

  @column()
  declare allExerciseTypes: boolean | null

  @hasMany(() => Exercice)
  declare exercices: HasMany<typeof Exercice>

  @hasMany(() => ActivityDisplayVariable)
  declare activityDisplayVariables: HasMany<typeof ActivityDisplayVariable>
}
