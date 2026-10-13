import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column, computed } from '@adonisjs/lucid/orm'
import Activity from '#models_pg/activity'
import Athlete from '#models_pg/athlete'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'

export default class ExerciseLoad extends BaseModel {
  @column({ isPrimary: true })
  declare id: string

  @column()
  declare athleteId: string

  @column()
  declare activityId: string

  @column()
  declare gearLoadKg: number | null

  @column()
  declare weaponLoadKg: number | null

  @computed()
  get totalLoadKg(): number {
    return (this.gearLoadKg ?? 0) + (this.weaponLoadKg ?? 0)
  }

  @belongsTo(() => Athlete)
  declare athlete: BelongsTo<typeof Athlete>

  @belongsTo(() => Activity)
  declare activity: BelongsTo<typeof Activity>

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime
}
