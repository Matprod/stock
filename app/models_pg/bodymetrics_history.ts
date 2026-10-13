import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column } from '@adonisjs/lucid/orm'
import Athlete from '#models_pg/athlete'
import Day from '#models_pg/day'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'

export default class BodymetricsHistory extends BaseModel {
  @column({ isPrimary: true })
  declare id: string

  @column()
  declare weight: number | null

  @column()
  declare fatPercentage: number | null

  @column()
  declare athleteId: string

  @column()
  declare dayId: string

  // Relations
  @belongsTo(() => Athlete)
  declare athlete: BelongsTo<typeof Athlete>

  @belongsTo(() => Day)
  declare day: BelongsTo<typeof Day>

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime
}
