import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column, computed } from '@adonisjs/lucid/orm'
import Activity from '#models/activity'
import Athlete from '#models/athlete'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'

export default class ExerciseLoad extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare athleteId: number

  @column()
  declare activityId: number

  @column()
  declare gearLoadKg: number | null

  @column()
  declare weaponLoadKg: number | null

  @computed()
  get totalLoadKg(): number {
    return (this.gearLoadKg ?? 0) + (this.weaponLoadKg ?? 0)
  }

  @belongsTo(() => Athlete, {
    foreignKey: 'athleteId',
  })
  declare athlete: BelongsTo<typeof Athlete>

  @belongsTo(() => Activity, {
    foreignKey: 'activityId',
  })
  declare activity: BelongsTo<typeof Activity>

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime
}
